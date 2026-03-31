// Hardware sizing constants for os-sizer — zero Vue imports (CALC-01)
// All values sourced from Red Hat official documentation (hardware-sizing.md)
import type { NodeSpec } from './types'

// Control plane minimums (hardware-sizing.md section 2.1)
export const CP_MIN: Readonly<NodeSpec> = { count: 3, vcpu: 4, ramGB: 16, storageGB: 100 }
export const WORKER_MIN: Readonly<NodeSpec> = { count: 2, vcpu: 2, ramGB: 8, storageGB: 100 }

// SNO profiles (hardware-sizing.md sections 2.3, 2.4)
export const SNO_STD_MIN: Readonly<NodeSpec> = { count: 1, vcpu: 8, ramGB: 16, storageGB: 120 }
export const SNO_EDGE_MIN: Readonly<NodeSpec> = { count: 1, vcpu: 8, ramGB: 32, storageGB: 120 }
export const SNO_TELECOM_MIN: Readonly<NodeSpec> = { count: 1, vcpu: 24, ramGB: 48, storageGB: 600 }

// TNA (hardware-sizing.md section 2.5)
export const TNA_CP_MIN: Readonly<NodeSpec> = { count: 2, vcpu: 4, ramGB: 16, storageGB: 100 }
export const TNA_ARBITER_MIN: Readonly<NodeSpec> = { count: 1, vcpu: 2, ramGB: 8, storageGB: 50 }

// TNF (hardware-sizing.md section 2.6)
export const TNF_CP_MIN: Readonly<NodeSpec> = { count: 2, vcpu: 4, ramGB: 16, storageGB: 100 }

// HCP (hardware-sizing.md section 2.7)
export const HCP_PODS_PER_CP = 78
export const HCP_CPU_PER_CP_IDLE = 5
export const HCP_RAM_PER_CP_IDLE = 18
export const HCP_CPU_PER_1000_QPS = 9
export const HCP_RAM_PER_1000_QPS = 2.5

// MicroShift (hardware-sizing.md section 2.8)
export const MICROSHIFT_SYS_MIN: Readonly<NodeSpec> = { count: 1, vcpu: 2, ramGB: 2, storageGB: 10 }

// ODF (hardware-sizing.md section 5.1)
export const ODF_MIN_CPU_PER_NODE = 16
export const ODF_MIN_RAM_PER_NODE_GB = 64
export const ODF_MIN_NODES = 3
export const ODF_CPU_PER_OSD = 2
export const ODF_RAM_PER_OSD_GB = 5

// CP sizing table (hardware-sizing.md section 6)
export const CP_SIZING_TABLE = [
  { maxWorkers: 24,  vcpu: 4,  ramGB: 16, vcpuOvnK: 4,  ramGBOvnK: 16  },
  { maxWorkers: 120, vcpu: 8,  ramGB: 32, vcpuOvnK: 8,  ramGBOvnK: 32  },
  { maxWorkers: 252, vcpu: 16, ramGB: 64, vcpuOvnK: 24, ramGBOvnK: 128 },
  { maxWorkers: 501, vcpu: 16, ramGB: 96, vcpuOvnK: 16, ramGBOvnK: 96  },
] as const

// Infra sizing table (hardware-sizing.md section 4)
export const INFRA_SIZING_TABLE = [
  { maxWorkers: 27,  vcpu: 4,  ramGB: 24  },
  { maxWorkers: 120, vcpu: 8,  ramGB: 48  },
  { maxWorkers: 252, vcpu: 16, ramGB: 128 },
] as const

// Global targets
export const TARGET_UTILIZATION = 0.70
export const MAX_PODS_PER_NODE = 200
export const CP_SAFETY_FACTOR = 0.60  // max 60% CP utilization
