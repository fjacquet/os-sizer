// Session export/import composable — pure TypeScript, no Vue lifecycle hooks.
// Mirrors the useUrlState.ts pattern (generateShareUrl / hydrateFromUrl).
// D-01: No ref(), computed(), or onMounted() — pure TS module.
// D-02: Exactly two named exports: exportSession and importSession.
// D-03: Reuses InputStateSchema from useUrlState.ts — no new schema.
// D-04: JSON.stringify(state, null, 2) for human-readable output.
// D-05: crypto.randomUUID() for each cluster id on import.

import { useInputStore } from '@/stores/inputStore'
import { downloadBlob } from './utils/download'
import { InputStateSchema, ClusterConfigSchema } from './useUrlState'
import type { z } from 'zod'

export function exportSession(): void {
  const store = useInputStore()
  // Exclude id from each cluster (ephemeral, re-generated on hydration)
  const state = {
    clusters: store.clusters.map(
      ({ id: _id, ...rest }) => rest as z.infer<typeof ClusterConfigSchema>,
    ),
  }
  const json = JSON.stringify(state, null, 2)
  const date = new Date().toISOString().split('T')[0]
  downloadBlob(json, `os-sizer-session-${date}.json`, 'application/json')
}

export function importSession(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(event.target!.result as string)
      } catch {
        reject(new Error('parse'))
        return
      }
      const result = InputStateSchema.safeParse(parsed)
      if (!result.success) {
        reject(new Error('schema'))
        return
      }
      const store = useInputStore()
      store.clusters = result.data.clusters.map((c) => ({
        ...c,
        id: crypto.randomUUID(),
      }))
      resolve()
    }
    reader.onerror = () => reject(new Error('read'))
    reader.readAsText(file)
  })
}
