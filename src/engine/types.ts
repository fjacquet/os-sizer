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

export interface NodeSpec {
  count: number
  vcpu: number
  ramGB: number
  storageGB: number
}

export interface ClusterConfig {
  id: string
  name: string
  topology: TopologyType
  // Phase 2 will add workload profile fields (pods, CPU/pod, RAM/pod, etc.)
}

export interface SizingResult {
  id: string
  sizing: {
    masterNodes: NodeSpec
    workerNodes: NodeSpec
    infraNodes: NodeSpec | null
  }
  validationErrors: ValidationWarning[]
}

export interface ValidationWarning {
  code: string
  severity: 'error' | 'warning'
  messageKey: string  // i18n key — NEVER a raw English string
}
