// URL state composable — lz-string compression + Zod schema validation
// Plain TypeScript — NO Vue lifecycle hooks (mirrors vcf-sizer useUrlState.ts)

import LZString from 'lz-string'
import { z } from 'zod'
import { useInputStore } from '@/stores/inputStore'

// ── Section 1: Schema definitions ────────────────────────────────────────────
// Compose from ClusterConfig shape — id excluded (re-generated on hydration)

const WorkloadProfileSchema = z
  .object({
    totalPods: z.number().int().min(0).default(10),
    podCpuMillicores: z.number().int().min(1).default(500),
    podMemMiB: z.number().int().min(1).default(512),
    nodeVcpu: z.number().int().min(2).max(256).default(16),
    nodeRamGB: z.number().int().min(8).max(1024).default(32),
  })
  .strip()

const AddOnConfigSchema = z
  .object({
    odfEnabled: z.boolean().default(false),
    odfExtraOsdCount: z.number().int().min(0).default(0),
    infraNodesEnabled: z.boolean().default(false),
    rhacmEnabled: z.boolean().default(false),
    rhacmManagedClusters: z.number().int().min(0).default(0),
    // Phase 9: OpenShift Virtualization
    virtEnabled: z.boolean().default(false),
    vmCount: z.number().int().min(0).default(50),
    vmsPerWorker: z.number().int().min(1).default(10),
    virtAvgVmVcpu: z.number().int().min(1).default(4),
    virtAvgVmRamGB: z.number().int().min(1).default(8),
    snoVirtMode: z.boolean().default(false),
    // Phase 10: GPU Node Engine
    gpuEnabled: z.boolean().default(false),
    gpuNodeCount: z.number().int().min(1).default(1),
    gpuMode: z.enum(['container', 'passthrough', 'vgpu']).default('container'),
    gpuModel: z.enum(['A100-40GB', 'A100-80GB', 'H100-80GB']).default('A100-40GB'),
    migProfile: z.string().default(''),
    gpuPerNode: z.number().int().min(1).default(1),
    // Phase 11: Red Hat OpenShift AI
    rhoaiEnabled: z.boolean().default(false),
    // Phase 14: non-ODF RWX storage backward-compat field
    rwxStorageAvailable: z.boolean().optional().default(false),
  })
  .strip()

export const ClusterConfigSchema = z
  .object({
    name: z.string().default('Cluster 1'),
    topology: z
      .enum([
        'standard-ha',
        'compact-3node',
        'sno',
        'two-node-arbiter',
        'two-node-fencing',
        'hcp',
        'microshift',
        'managed-cloud',
      ])
      .default('standard-ha'),
    snoProfile: z.enum(['standard', 'edge', 'telecom-vdu']).default('standard'),
    hcpHostedClusters: z.number().int().min(1).default(1),
    hcpQpsPerCluster: z.number().int().min(0).default(1000),
    workload: WorkloadProfileSchema.default(() => WorkloadProfileSchema.parse({})),
    addOns: AddOnConfigSchema.default(() => AddOnConfigSchema.parse({})),
    environment: z.enum(['datacenter', 'edge', 'far-edge', 'cloud']).default('datacenter'),
    haRequired: z.boolean().default(true),
    airGapped: z.boolean().default(false),
    maxNodes: z.number().int().positive().nullable().default(null),
    // Phase 13: multi-cluster topology role (.optional().default() for v2.0 session backward compat)
    role: z.enum(['hub', 'spoke', 'standalone']).optional().default('standalone'),
  })
  .strip()
// NOTE: id is excluded from schema — re-generated on hydration

export const InputStateSchema = z
  .object({
    clusters: z.array(ClusterConfigSchema).min(1).default(() => [ClusterConfigSchema.parse({})]),
  })
  .strip()

export type InputState = z.infer<typeof InputStateSchema>

// ── Section 2: hydrateFromUrl ─────────────────────────────────────────────────
export function hydrateFromUrl(): void {
  const params = new URLSearchParams(window.location.search)
  const compressed = params.get('c')
  if (!compressed) return
  const json = LZString.decompressFromEncodedURIComponent(compressed)
  if (!json) {
    console.warn('[os-sizer] URL state: decompression failed (malformed ?c= param)')
    return
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    console.warn('[os-sizer] URL state: JSON parse error')
    return
  }
  const result = InputStateSchema.safeParse(parsed)
  if (!result.success) {
    console.warn('[os-sizer] URL state: schema validation failed', result.error.issues)
    return
  }
  const store = useInputStore()
  store.clusters = result.data.clusters.map((c) => ({
    ...c,
    id: crypto.randomUUID(), // Re-generate ID — URL ids are not meaningful
  }))
  // activeClusterIndex NOT restored — stays at 0
}

// ── Section 3: generateShareUrl ───────────────────────────────────────────────
export function generateShareUrl(): string {
  const store = useInputStore()
  // Exclude id from each cluster (ephemeral, re-generated on hydration)
  const state: InputState = {
    clusters: store.clusters.map(
      ({ id: _id, ...rest }) => rest as z.infer<typeof ClusterConfigSchema>,
    ),
  }
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(state))
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('c', compressed)
  return url.toString()
}
