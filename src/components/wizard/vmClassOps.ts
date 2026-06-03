// Pure, immutable VM-class array operations (testable without mounting components).
import type { VmClass } from '@/engine/types'

export function addVmClass(classes: VmClass[]): VmClass[] {
  return [
    ...classes,
    { id: crypto.randomUUID(), name: 'New', vcpu: 2, ramGB: 4, diskGB: 40, count: 0 },
  ]
}

export function removeVmClass(classes: VmClass[], index: number): VmClass[] {
  return classes.filter((_, i) => i !== index)
}

export function updateVmClass(
  classes: VmClass[],
  index: number,
  patch: Partial<VmClass>,
): VmClass[] {
  return classes.map((c, i) => (i === index ? { ...c, ...patch } : c))
}
