import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateInputs } from './validation'
import { createDefaultClusterConfig } from './defaults'

describe('engine zero-Vue-import constraint (ENG-09)', () => {
  it('no engine .ts file imports from vue, pinia, or vue-i18n', () => {
    const engineDir = join(__dirname)
    const tsFiles = readdirSync(engineDir).filter(
      (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'),
    )
    for (const file of tsFiles) {
      const content = readFileSync(join(engineDir, file), 'utf-8')
      expect(content, `${file} imports vue`).not.toMatch(/from\s+['"]vue['"]/)
      expect(content, `${file} imports pinia`).not.toMatch(/from\s+['"]pinia['"]/)
      expect(content, `${file} imports vue-i18n`).not.toMatch(/from\s+['"]vue-i18n['"]/)
    }
  })
})

describe('validateInputs', () => {
  it('returns empty array for valid default config', () => {
    expect(validateInputs(createDefaultClusterConfig(0))).toEqual([])
  })

  it('returns error for negative pod count', () => {
    const config = createDefaultClusterConfig(0)
    config.workload.totalPods = -1
    expect(validateInputs(config).some((w) => w.code === 'NEGATIVE_PODS' && w.severity === 'error')).toBe(true)
  })

  it('returns warning for worker RAM below minimum', () => {
    const config = createDefaultClusterConfig(0)
    config.workload.nodeRamGB = 4
    expect(validateInputs(config).some((w) => w.code === 'WORKER_RAM_BELOW_MIN')).toBe(true)
  })

  it('returns error for ODF on SNO topology', () => {
    const config = createDefaultClusterConfig(0)
    config.topology = 'sno'
    config.addOns.odfEnabled = true
    expect(validateInputs(config).some((w) => w.code === 'ODF_INCOMPATIBLE_TOPOLOGY')).toBe(true)
  })

  it('all messageKeys are i18n keys without spaces', () => {
    const config = createDefaultClusterConfig(0)
    config.workload.totalPods = -1
    config.workload.nodeRamGB = 1
    for (const w of validateInputs(config)) {
      expect(w.messageKey).toMatch(/^\S+$/)
    }
  })
})

describe('WARN-02: VIRT_RWX_REQUIRES_ODF', () => {
  it('emits warning when virtEnabled=true, odfEnabled=false, topology=standard-ha', () => {
    const config = createDefaultClusterConfig(0)
    config.topology = 'standard-ha'
    config.addOns.virtEnabled = true
    config.addOns.odfEnabled = false
    const warnings = validateInputs(config)
    expect(warnings.some(w => w.code === 'VIRT_RWX_REQUIRES_ODF' && w.severity === 'warning')).toBe(true)
  })

  it('no warning when virtEnabled=true and odfEnabled=true', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.virtEnabled = true
    config.addOns.odfEnabled = true
    const warnings = validateInputs(config)
    expect(warnings.some(w => w.code === 'VIRT_RWX_REQUIRES_ODF')).toBe(false)
  })

  it('no warning when virtEnabled=false', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.virtEnabled = false
    config.addOns.odfEnabled = false
    const warnings = validateInputs(config)
    expect(warnings.some(w => w.code === 'VIRT_RWX_REQUIRES_ODF')).toBe(false)
  })

  it('suppresses VIRT_RWX_REQUIRES_ODF for SNO topology and emits SNO_VIRT_NO_LIVE_MIGRATION instead', () => {
    const config = createDefaultClusterConfig(0)
    config.topology = 'sno'
    config.addOns.virtEnabled = true
    config.addOns.odfEnabled = false
    const warnings = validateInputs(config)
    // VIRT_RWX_REQUIRES_ODF is suppressed on SNO
    expect(warnings.some(w => w.code === 'VIRT_RWX_REQUIRES_ODF')).toBe(false)
    // SNO_VIRT_NO_LIVE_MIGRATION is emitted because virtEnabled=true on SNO topology
    expect(warnings.some(w => w.code === 'SNO_VIRT_NO_LIVE_MIGRATION' && w.severity === 'warning')).toBe(true)
  })
})
