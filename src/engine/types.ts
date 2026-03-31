// Engine types for os-sizer — zero Vue imports (CALC-01)

export type TopologyType =
  | 'standard-ha'       // 3 masters + N workers + optional infra
  | 'compact-3node'     // masters double as workers
  | 'sno'               // single node OpenShift
  | 'two-node-arbiter'  // TNA
  | 'two-node-fencing'  // TNF — bare-metal only
  | 'hcp'               // hosted control planes
  | 'microshift'        // edge/IoT
  | 'managed-cloud'     // ROSA/ARO — informational only

export type SnoProfile = 'standard' | 'edge' | 'telecom-vdu'

export type EnvironmentType = 'datacenter' | 'edge' | 'far-edge' | 'cloud'

export interface NodeSpec {
  count: number
  vcpu: number
  ramGB: number
  storageGB: number
}

export interface WorkloadProfile {
  totalPods: number           // default 10
  podCpuMillicores: number    // avg CPU request per pod, default 500
  podMemMiB: number           // avg RAM request per pod, default 512
  nodeVcpu: number            // worker node size, default 16
  nodeRamGB: number           // worker node size, default 32
}

export interface AddOnConfig {
  odfEnabled: boolean         // default false
  odfExtraOsdCount: number    // extra OSDs per storage node beyond base, default 0
  infraNodesEnabled: boolean  // default false
  rhacmEnabled: boolean       // default false
  rhacmManagedClusters: number // default 0
}

export interface ClusterConfig {
  id: string
  name: string
  topology: TopologyType
  snoProfile: SnoProfile           // default 'standard'
  hcpHostedClusters: number        // default 1
  hcpQpsPerCluster: number         // default 1000
  workload: WorkloadProfile
  addOns: AddOnConfig
}

export interface ClusterSizing {
  masterNodes: NodeSpec
  workerNodes: NodeSpec | null     // null for compact-3node, SNO, MicroShift
  infraNodes: NodeSpec | null
  odfNodes: NodeSpec | null
  rhacmWorkers: NodeSpec | null
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
  messageKey: string  // i18n key — NEVER a raw English string
}

export interface RecommendationConstraints {
  environment: EnvironmentType
  haRequired: boolean
  maxNodes: number | null
  airGapped: boolean
  estimatedWorkers: number
  addOns: { odf: boolean; rhacm: boolean }
}

export interface TopologyRecommendation {
  topology: TopologyType
  fitScore: number           // 0-100
  justificationKey: string   // i18n key, no spaces
  warningKeys: string[]      // i18n keys for caveats
}
