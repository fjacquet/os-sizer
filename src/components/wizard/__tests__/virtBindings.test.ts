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

  it('patching virt.targetUtilization persists as a fraction and lowers worker count', () => {
    const store = useInputStore()
    const c = store.clusters[0]!
    store.updateCluster(c.id, {
      mode: 'virtualization',
      virt: { ...c.virt!, targetUtilization: 0.7 },
    })
    expect(store.clusters[0]!.virt?.targetUtilization).toBe(0.7)
    const lower = calcCluster(store.clusters[0]!).sizing
    const full = calcCluster({
      ...store.clusters[0]!,
      virt: { ...store.clusters[0]!.virt!, targetUtilization: 1 },
    }).sizing
    expect(lower.virtWorkerNodes!.count).toBeGreaterThanOrEqual(full.virtWorkerNodes!.count)
  })

  it('exposes the target utilization i18n label', async () => {
    const en = (await import('@/i18n/locales/en.json')).default as Record<string, Record<string, string>>
    expect(en.virt.targetUtilization).toBe('Target utilization')
  })
})
