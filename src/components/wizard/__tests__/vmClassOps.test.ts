import { describe, it, expect } from 'vitest'
import { addVmClass, removeVmClass, updateVmClass } from '../vmClassOps'
import type { VmClass } from '@/engine/types'

const base: VmClass[] = [{ id: 'a', name: 'Small', vcpu: 2, ramGB: 4, diskGB: 40, count: 10 }]

describe('vmClassOps', () => {
  it('addVmClass appends a new class with a fresh id', () => {
    const next = addVmClass(base)
    expect(next).toHaveLength(2)
    expect(next[0]).toBe(base[0]) // original preserved
    expect(next[1]?.id).not.toBe('a')
    expect(next[1]?.count).toBe(0)
  })

  it('removeVmClass drops by index immutably', () => {
    const two = addVmClass(base)
    const next = removeVmClass(two, 0)
    expect(next).toHaveLength(1)
    expect(next[0]?.id).toBe(two[1]?.id)
  })

  it('updateVmClass patches one field by index', () => {
    const next = updateVmClass(base, 0, { count: 99 })
    expect(next[0]?.count).toBe(99)
    expect(next[0]?.name).toBe('Small')
    expect(base[0]?.count).toBe(10) // input untouched
  })
})
