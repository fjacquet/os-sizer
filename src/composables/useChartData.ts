/**
 * Pure TypeScript chart data builders — no Vue, no Pinia (CALC-01 equivalent for composables).
 * Accepts ClusterSizing, returns plain data structures.
 * Used by: chart components (via computed wrapping), export composables (direct call).
 */
import type { ClusterSizing, NodeSpec } from '@/engine/types'

export interface ChartNodeRow {
  label: string // English label — NOT i18n key (export consumers lack vue-i18n context)
  spec: NodeSpec
}

export function buildChartRows(sizing: ClusterSizing): ChartNodeRow[] {
  return [
    { label: 'Control Plane', spec: sizing.masterNodes },
    ...(sizing.workerNodes ? [{ label: 'Workers', spec: sizing.workerNodes }] : []),
    ...(sizing.infraNodes ? [{ label: 'Infra Nodes', spec: sizing.infraNodes }] : []),
    ...(sizing.odfNodes ? [{ label: 'ODF Storage', spec: sizing.odfNodes }] : []),
    ...(sizing.rhacmWorkers ? [{ label: 'RHACM Hub', spec: sizing.rhacmWorkers }] : []),
    ...(sizing.virtWorkerNodes ? [{ label: 'Virt Workers', spec: sizing.virtWorkerNodes }] : []),
    ...(sizing.gpuNodes ? [{ label: 'GPU Nodes', spec: sizing.gpuNodes }] : []),
  ]
}

export function buildVcpuData(rows: ChartNodeRow[]): number[] {
  return rows.map((r) => r.spec.count * r.spec.vcpu)
}

export function buildRamData(rows: ChartNodeRow[]): number[] {
  return rows.map((r) => r.spec.count * r.spec.ramGB)
}

export function buildStorageData(rows: ChartNodeRow[]): number[] {
  return rows.map((r) => r.spec.count * r.spec.storageGB)
}

export function buildNodeCountData(rows: ChartNodeRow[]): number[] {
  return rows.map((r) => r.spec.count)
}
