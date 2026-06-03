// Engine types for os-sizer — zero Vue imports (CALC-01)

export type TopologyType =
  | 'standard-ha' // 3 masters + N workers + optional infra
  | 'compact-3node' // masters double as workers
  | 'sno' // single node OpenShift
  | 'two-node-arbiter' // TNA
  | 'two-node-fencing' // TNF — bare-metal only
  | 'hcp' // hosted control planes
  | 'microshift' // edge/IoT
  | 'managed-cloud' // ROSA/ARO — informational only

export type SnoProfile = 'standard' | 'edge' | 'telecom-vdu'

export type EnvironmentType = 'datacenter' | 'edge' | 'far-edge' | 'cloud'

export interface NodeSpec {
  count: number
  vcpu: number
  ramGB: number
  storageGB: number
}

export interface WorkloadProfile {
  totalPods: number // default 10
  podCpuMillicores: number // avg CPU request per pod, default 500
  podMemMiB: number // avg RAM request per pod, default 512
  nodeVcpu: number // worker node size, default 16
  nodeRamGB: number // worker node size, default 32
}

export interface AddOnConfig {
  odfEnabled: boolean // default false
  odfExtraOsdCount: number // extra OSDs per storage node beyond base, default 0
  infraNodesEnabled: boolean // default false
  rhacmEnabled: boolean // default false
  rhacmManagedClusters: number // default 0
  // Phase 9: OpenShift Virtualization
  virtEnabled: boolean // OpenShift Virtualization / CNV enabled
  vmCount: number // total number of VMs to host (default 50)
  vmsPerWorker: number // target VM density per worker node (default 10)
  virtAvgVmVcpu: number // average vCPU count per VM (default 4)
  virtAvgVmRamGB: number // average RAM per VM in GB (default 8)
  snoVirtMode: boolean // SNO-with-Virt profile (SNO-01)
  // Phase 10: GPU Node Engine
  gpuEnabled: boolean // dedicated GPU node pool enabled (default false)
  gpuNodeCount: number // number of GPU nodes in pool — user-specified (default 1)
  gpuMode: 'container' | 'passthrough' | 'vgpu' // GPU workload mode (default 'container')
  gpuModel: 'A100-40GB' | 'A100-80GB' | 'H100-80GB' // GPU model (default 'A100-40GB')
  migProfile: string // MIG profile name e.g. '1g.5gb' — empty string = no MIG (default '')
  gpuPerNode: number // GPUs per node (default 1)
  // Phase 11: Red Hat OpenShift AI
  rhoaiEnabled: boolean // RHOAI operator add-on enabled (default false)
  /** Non-ODF RWX storage class available for live migration (Phase 14) */
  rwxStorageAvailable: boolean
}

export interface ClusterConfig {
  id: string
  name: string
  role?: 'hub' | 'spoke' | 'standalone'
  topology: TopologyType
  snoProfile: SnoProfile // default 'standard'
  hcpHostedClusters: number // default 1
  hcpQpsPerCluster: number // default 1000
  workload: WorkloadProfile
  addOns: AddOnConfig
  // Environment constraint fields — used by recommendation engine
  environment: EnvironmentType // default 'datacenter'
  haRequired: boolean // default true
  airGapped: boolean // default false
  maxNodes: number | null // default null (no limit)
}

export interface ClusterSizing {
  masterNodes: NodeSpec
  workerNodes: NodeSpec | null // null for compact-3node, SNO, MicroShift
  infraNodes: NodeSpec | null
  odfNodes: NodeSpec | null
  rhacmWorkers: NodeSpec | null
  virtWorkerNodes: NodeSpec | null // Phase 9: dedicated VM-hosting worker pool
  gpuNodes: NodeSpec | null // Phase 9: placeholder for Phase 10 GPU calculator
  virtStorageGB: number // Phase 9: estimated storage budget for VM PVCs
  rhoaiOverhead: { vcpu: number; ramGB: number } | null // Phase 12: RHOAI operator overhead addend (set by calcRHOAI, null otherwise)
  totals: { vcpu: number; ramGB: number; storageGB: number }
}

export interface SizingResult {
  id: string
  sizing: ClusterSizing
  recommendations: TopologyRecommendation[]
  validationErrors: ValidationWarning[]
}

export interface ValidationWarning {
  code: string
  severity: 'error' | 'warning'
  messageKey: string // i18n key — NEVER a raw English string
}

export interface RecommendationConstraints {
  environment: EnvironmentType
  haRequired: boolean
  maxNodes: number | null
  airGapped: boolean
  estimatedWorkers: number
  addOns: { odf: boolean; rhacm: boolean; virt: boolean }
}

export interface TopologyRecommendation {
  topology: TopologyType
  fitScore: number // 0-100
  justificationKey: string // i18n key, no spaces
  warningKeys: string[] // i18n keys for caveats
}

// ── Virtualization mode (Phase 1) ────────────────────────────────────────────

export type SizingMode = 'container' | 'virtualization'

/** One row in the VM size-classes table (e.g. Small/Medium/Large). */
export interface VmClass {
  id: string
  name: string
  vcpu: number // vCPUs per VM
  ramGB: number // guest RAM per VM
  diskGB: number // primary disk per VM
  count: number // number of VMs in this class
}

/** Physical bare-metal worker node shape (OVE favours dense dual-socket). */
export interface NodeShape {
  physicalCores: number // sockets × cores/socket
  threadsPerCore: number // 2 = hyperthreading on, 1 = off
  ramGB: number // installed RAM per node
}

export type StorageBackend = 'odf' | 'external-rwx'

export interface VirtConfig {
  vmClasses: VmClass[]
  cpuOvercommitRatio: number // vCPU per thread; 10 default, 4 conservative, 1 = dedicated
  redundancy: 'none' | 'n+1' | 'n+2'
  nodeShape: NodeShape
  storageBackend: StorageBackend
}

/** Aggregate VM demand across all classes. */
export interface VmDemand {
  totalVms: number
  totalVcpu: number
  totalGuestRamGB: number
  totalOverheadRamGB: number
  totalDiskGB: number
}

/** Per-node capacity available to VMs after reservations. */
export interface NodeVmCapacity {
  allocThreads: number // schedulable CPU threads after system-reserved + KubeVirt infra
  vcpuCapacity: number // allocThreads × overcommit ratio
  ramCapacityGB: number // allocatable RAM after reservations
}

export type LimitingResource = 'cpu' | 'ram' | 'density'

export interface VirtWorkerSizing {
  baseNodes: number
  spareNodes: number
  totalNodes: number
  limitingResource: LimitingResource
  achievedOvercommit: number // realised vCPU : thread ratio
  vmsPerNode: number
  cpuUtilizationPct: number
  ramUtilizationPct: number
}
