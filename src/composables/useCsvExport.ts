// CSV export composable — plain TypeScript, no external libraries
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import type { ClusterSizing, NodeSpec } from '@/engine/types'

type NodeEntry = { label: string; spec: NodeSpec }

function getNodeEntries(sizing: ClusterSizing): NodeEntry[] {
  return [
    { label: 'Control Plane', spec: sizing.masterNodes },
    ...(sizing.workerNodes ? [{ label: 'Workers', spec: sizing.workerNodes }] : []),
    ...(sizing.infraNodes ? [{ label: 'Infra Nodes', spec: sizing.infraNodes }] : []),
    ...(sizing.odfNodes ? [{ label: 'ODF Storage', spec: sizing.odfNodes }] : []),
    ...(sizing.rhacmWorkers ? [{ label: 'RHACM Hub', spec: sizing.rhacmWorkers }] : []),
  ]
}

export function buildCsvContent(sizing: ClusterSizing): string {
  const header = 'Node Type,Count,vCPU,RAM (GB),Storage (GB)'
  const rows = getNodeEntries(sizing).map(
    (e) => `${e.label},${e.spec.count},${e.spec.vcpu},${e.spec.ramGB},${e.spec.storageGB}`,
  )
  return [header, ...rows].join('\n')
}

function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function generateCsvReport(): void {
  const input = useInputStore()
  const calc = useCalculationStore()
  const clusterIdx = input.activeClusterIndex
  const cluster = input.clusters[clusterIdx] ?? input.clusters[0]
  const result = calc.clusterResults[clusterIdx] ?? calc.clusterResults[0]
  const csv = buildCsvContent(result.sizing)
  const filename = `os-sizer-${cluster.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`
  downloadBlob(csv, filename, 'text/csv; charset=utf-8')
}
