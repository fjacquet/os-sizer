/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from './uiStore'

describe('uiStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes wizard step at 1', () => {
    const store = useUiStore()
    expect(store.currentWizardStep).toBe(1)
  })

  it('setWizardStep(4) sets step to 4 (os-sizer has 4 steps, not 3)', () => {
    const store = useUiStore()
    store.setWizardStep(4)
    expect(store.currentWizardStep).toBe(4)
  })

  it('setWizardStep(3) sets step to 3', () => {
    const store = useUiStore()
    store.setWizardStep(3)
    expect(store.currentWizardStep).toBe(3)
  })

  it('confirmTopology() sets topologyConfirmed to true', () => {
    const store = useUiStore()
    expect(store.topologyConfirmed).toBe(false)
    store.confirmTopology()
    expect(store.topologyConfirmed).toBe(true)
  })
})
