/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useInputStore } from '@/stores/inputStore'
import { calcCluster } from '@/engine'

describe('virtualization store bindings', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { language: 'en' })
    setActivePinia(createPinia())
  })

  it('switching mode to virtualization persists', () => {
    const store = useInputStore()
    const id = store.clusters[0]!.id
    store.updateCluster(id, { mode: 'virtualization' })
    expect(store.clusters[0]!.mode).toBe('virtualization')
  })

  it('patching virt.cpuOvercommitRatio persists and recomputes', () => {
    const store = useInputStore()
    const c = store.clusters[0]!
    store.updateCluster(c.id, {
      mode: 'virtualization',
      virt: { ...c.virt!, cpuOvercommitRatio: 4 },
    })
    expect(store.clusters[0]!.virt?.cpuOvercommitRatio).toBe(4)
    const { sizing } = calcCluster(store.clusters[0]!)
    expect(sizing.virtWorkerNodes).not.toBeNull()
    expect(sizing.virtMetrics?.limitingResource).toBeDefined()
  })

  it('patching storageBackend to external-rwx drops ODF nodes', () => {
    const store = useInputStore()
    const c = store.clusters[0]!
    store.updateCluster(c.id, {
      mode: 'virtualization',
      virt: { ...c.virt!, storageBackend: 'external-rwx' },
    })
    const { sizing } = calcCluster(store.clusters[0]!)
    expect(sizing.odfNodes).toBeNull()
  })
})
