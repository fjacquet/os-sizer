import { describe, it, expect } from 'vitest'
import { virtStorage } from './storage'

describe('virtStorage', () => {
  it('ODF: raw ≈ usable × 3 / 0.85', () => {
    const s = virtStorage(15300, 'odf')
    expect(s.usableGB).toBe(15300)
    expect(s.rawGB).toBeCloseTo(54000, 0) // 15300 × 3 / 0.85
    expect(s.backend).toBe('odf')
  })

  it('external-rwx: raw is 0 (provider-managed)', () => {
    const s = virtStorage(15300, 'external-rwx')
    expect(s.usableGB).toBe(15300)
    expect(s.rawGB).toBe(0)
    expect(s.backend).toBe('external-rwx')
  })
})
