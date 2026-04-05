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

describe('WARN-04/05: VIRT_RWX_STORAGE_REQUIRED', () => {
  it('emits warning when virtEnabled=true, odfEnabled=false, rwxStorageAvailable=false, topology=standard-ha', () => {
    const config = createDefaultClusterConfig(0)
    config.topology = 'standard-ha'
    config.addOns.virtEnabled = true
    config.addOns.odfEnabled = false
    config.addOns.rwxStorageAvailable = false
    const warnings = validateInputs(config)
    expect(warnings.some(w => w.code === 'VIRT_RWX_STORAGE_REQUIRED' && w.severity === 'warning')).toBe(true)
  })

  it('no warning when virtEnabled=true and odfEnabled=true', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.virtEnabled = true
    config.addOns.odfEnabled = true
    config.addOns.rwxStorageAvailable = false
    const warnings = validateInputs(config)
    expect(warnings.some(w => w.code === 'VIRT_RWX_STORAGE_REQUIRED')).toBe(false)
  })

  it('no warning when virtEnabled=false', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.virtEnabled = false
    config.addOns.odfEnabled = false
    config.addOns.rwxStorageAvailable = false
    const warnings = validateInputs(config)
    expect(warnings.some(w => w.code === 'VIRT_RWX_STORAGE_REQUIRED')).toBe(false)
  })

  it('suppresses VIRT_RWX_STORAGE_REQUIRED for SNO topology and emits SNO_VIRT_NO_LIVE_MIGRATION instead', () => {
    const config = createDefaultClusterConfig(0)
    config.topology = 'sno'
    config.addOns.virtEnabled = true
    config.addOns.odfEnabled = false
    config.addOns.rwxStorageAvailable = false
    const warnings = validateInputs(config)
    // VIRT_RWX_STORAGE_REQUIRED is suppressed on SNO
    expect(warnings.some(w => w.code === 'VIRT_RWX_STORAGE_REQUIRED')).toBe(false)
    // SNO_VIRT_NO_LIVE_MIGRATION is emitted because virtEnabled=true on SNO topology
    expect(warnings.some(w => w.code === 'SNO_VIRT_NO_LIVE_MIGRATION' && w.severity === 'warning')).toBe(true)
  })

  it('no warning when virtEnabled=true, odfEnabled=false, but rwxStorageAvailable=true (WARN-04 core)', () => {
    const config = createDefaultClusterConfig(0)
    config.topology = 'standard-ha'
    config.addOns.virtEnabled = true
    config.addOns.odfEnabled = false
    config.addOns.rwxStorageAvailable = true
    const warnings = validateInputs(config)
    expect(warnings.some(w => w.code === 'VIRT_RWX_STORAGE_REQUIRED')).toBe(false)
  })
})

describe('WARN-01: GPU passthrough blocks live migration', () => {
  it('emits GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION when gpuEnabled=true and gpuMode=passthrough', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.gpuEnabled = true
    config.addOns.gpuMode = 'passthrough'
    const warnings = validateInputs(config)
    expect(warnings.some(w => w.code === 'GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION' && w.severity === 'warning')).toBe(true)
  })

  it('no warning when gpuMode=container', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.gpuEnabled = true
    config.addOns.gpuMode = 'container'
    const warnings = validateInputs(config)
    expect(warnings.some(w => w.code === 'GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION')).toBe(false)
  })

  it('no warning when gpuMode=vgpu', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.gpuEnabled = true
    config.addOns.gpuMode = 'vgpu'
    const warnings = validateInputs(config)
    expect(warnings.some(w => w.code === 'GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION')).toBe(false)
  })

  it('no warning when gpuEnabled=false even if gpuMode=passthrough', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.gpuEnabled = false
    config.addOns.gpuMode = 'passthrough'
    const warnings = validateInputs(config)
    expect(warnings.some(w => w.code === 'GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION')).toBe(false)
  })
})

describe('WARN-03: MIG profile with KubeVirt VMs unsupported', () => {
  it('emits MIG_PROFILE_WITH_KUBEVIRT_UNSUPPORTED when gpuEnabled=true, migProfile set, and virtEnabled=true', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.gpuEnabled = true
    config.addOns.migProfile = '1g.5gb'
    config.addOns.virtEnabled = true
    const warnings = validateInputs(config)
    expect(warnings.some(w => w.code === 'MIG_PROFILE_WITH_KUBEVIRT_UNSUPPORTED' && w.severity === 'warning')).toBe(true)
  })

  it('no warning when migProfile is empty string (no MIG configured)', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.gpuEnabled = true
    config.addOns.migProfile = ''
    config.addOns.virtEnabled = true
    const warnings = validateInputs(config)
    expect(warnings.some(w => w.code === 'MIG_PROFILE_WITH_KUBEVIRT_UNSUPPORTED')).toBe(false)
  })

  it('no warning when virtEnabled=false (no KubeVirt VMs)', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.gpuEnabled = true
    config.addOns.migProfile = '1g.5gb'
    config.addOns.virtEnabled = false
    const warnings = validateInputs(config)
    expect(warnings.some(w => w.code === 'MIG_PROFILE_WITH_KUBEVIRT_UNSUPPORTED')).toBe(false)
  })

  it('no warning when gpuEnabled=false', () => {
    const config = createDefaultClusterConfig(0)
    config.addOns.gpuEnabled = false
    config.addOns.migProfile = '1g.5gb'
    config.addOns.virtEnabled = true
    const warnings = validateInputs(config)
    expect(warnings.some(w => w.code === 'MIG_PROFILE_WITH_KUBEVIRT_UNSUPPORTED')).toBe(false)
  })
})
