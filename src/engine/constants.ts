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

// KubeVirt worker node per-node CPU overhead
// Source: Red Hat OpenShift Virtualization docs — "2 additional cores per virt-enabled node"
export const VIRT_OVERHEAD_CPU_PER_NODE = 2          // vCPU reserved per virt-enabled worker

// KubeVirt per-VM memory overhead formula constants (virt-launcher pod overhead)
// Source: developers.redhat.com/blog/2025/01/31/memory-management-openshift-virtualization
// Formula: overheadMiB = VIRT_VM_OVERHEAD_BASE_MIB + VIRT_VM_OVERHEAD_PER_VCPU_MIB * vCPUs + VIRT_VM_OVERHEAD_GUEST_RAM_RATIO * guestRAM_MiB
export const VIRT_VM_OVERHEAD_BASE_MIB = 218
export const VIRT_VM_OVERHEAD_PER_VCPU_MIB = 8
export const VIRT_VM_OVERHEAD_GUEST_RAM_RATIO = 0.002  // 0.2% of guest RAM in MiB

// SNO-with-Virt minimum hardware profile (SNO-01)
// Source: Red Hat SNO docs + access.redhat.com/solutions/7014308
// Base SNO_STD_MIN is 8 vCPU / 16 GB / 120 GB — virt requires 14 vCPU / 32 GB / 170 GB
// storageGB 170 = 120 GB root disk + 50 GB second disk for VM PVCs (hostpath-provisioner)
export const SNO_VIRT_MIN: Readonly<NodeSpec> = { count: 1, vcpu: 14, ramGB: 32, storageGB: 170 }
export const SNO_VIRT_STORAGE_EXTRA_GB = 50           // second disk for VM PVCs

// MIG profiles for GPU nodes — static lookup table (GPU-04)
// Source: NVIDIA MIG User Guide — docs.nvidia.com/datacenter/tesla/mig-user-guide/supported-mig-profiles.html
// Scope: A100-40GB is the v2.0 primary target per REQUIREMENTS.md GPU-04; A100-80GB and H100-80GB follow identical structure
export const MIG_PROFILES: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  'A100-40GB': {
    '1g.5gb':  7,  // 7 instances × 5 GB = 35 GB (1 slice reserved for system)
    '2g.10gb': 3,  // 3 instances × 10 GB
    '3g.20gb': 2,  // 2 instances × 20 GB
    '7g.40gb': 1,  // 1 instance (whole GPU in MIG mode)
  },
  'A100-80GB': {
    '1g.10gb': 7,
    '2g.20gb': 3,
    '3g.40gb': 2,
    '7g.80gb': 1,
  },
  'H100-80GB': {
    '1g.10gb': 7,
    '2g.20gb': 3,
    '3g.40gb': 2,
    '7g.80gb': 1,
  },
} as const

// GPU node hardware minimums (Phase 10)
// No authoritative Red Hat sizing table exists for GPU nodes; values reflect general bare-metal GPU server minimums
export const GPU_NODE_MIN_VCPU = 16        // typical bare-metal GPU node baseline
export const GPU_NODE_MIN_RAM_GB = 64      // GPU nodes require sufficient CPU-side RAM for driver + workloads
export const GPU_NODE_MIN_STORAGE_GB = 200 // OS + GPU drivers + container images
