// Mode-agnostic node reservation + VM overhead primitives — zero Vue imports (CALC-01)
import {
  VIRT_VM_OVERHEAD_BASE_MIB,
  VIRT_VM_OVERHEAD_PER_VCPU_MIB,
  VIRT_VM_OVERHEAD_GUEST_RAM_RATIO,
  SYSTEM_RESERVED_CPU_FIRST,
  SYSTEM_RESERVED_CPU_PER_THREAD,
  SYSTEM_RESERVED_CPU_MIN,
} from '../constants'

/** KubeVirt virt-launcher per-VM memory overhead in MiB. */
export function perVmMemoryOverheadMiB(vcpu: number, ramGB: number): number {
  return (
    VIRT_VM_OVERHEAD_BASE_MIB +
    VIRT_VM_OVERHEAD_PER_VCPU_MIB * vcpu +
    VIRT_VM_OVERHEAD_GUEST_RAM_RATIO * (ramGB * 1024)
  )
}

/** OpenShift system-reserved CPU in cores: 60m first thread + 12m per additional, floored at 500m. */
export function systemReservedCpuCores(threads: number): number {
  const reserved =
    SYSTEM_RESERVED_CPU_FIRST + SYSTEM_RESERVED_CPU_PER_THREAD * Math.max(threads - 1, 0)
  return Math.max(reserved, SYSTEM_RESERVED_CPU_MIN)
}

// Re-export the existing tiered system-reserved RAM helper so callers import reservations from one place.
export { allocatableRamGB } from '../formulas'
