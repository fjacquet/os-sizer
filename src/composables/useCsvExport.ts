// CSV export composable — plain TypeScript, no external libraries
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import type { ClusterSizing, NodeSpec } from '@/engine/types'
import { downloadBlob } from './utils/download'

type NodeEntry = { label: string; spec: NodeSpec }

function getNodeEntries(sizing: ClusterSizing): NodeEntry[] {
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

export function buildCsvContent(sizing: ClusterSizing): string {
  const header = 'Node Type,Count,vCPU,RAM (GB),Storage (GB)'
  const rows = getNodeEntries(sizing).map(
    (e) => `${e.label},${e.spec.count},${e.spec.vcpu},${e.spec.ramGB},${e.spec.storageGB}`,
  )
  const rhoaiRow = sizing.rhoaiOverhead
    ? [
        `RHOAI Overhead (KServe / DS Pipelines / Model Registry),—,+${sizing.rhoaiOverhead.vcpu},+${sizing.rhoaiOverhead.ramGB},—`,
      ]
    : []
  return [header, ...rows, ...rhoaiRow].join('\n')
}

export function buildMultiClusterCsvContent(
  clusters: { name: string }[],
  clusterSizings: ClusterSizing[],
  aggregateTotals: { vcpu: number; ramGB: number; storageGB: number },
): string {
  const header = 'Node Type,Count,vCPU,RAM (GB),Storage (GB)'
  const sections: string[] = []

  for (let i = 0; i < clusters.length; i++) {
    const clusterName = clusters[i].name
    const sizing = clusterSizings[i]

    // Cluster name grouping row (D-09): name in col A, rest empty
    // Escape cluster names containing commas (Pitfall 4 from RESEARCH.md)
    const safeName = clusterName.includes(',') ? `"${clusterName}"` : clusterName
    sections.push(`${safeName},,,,`)

    // Header row repeated per cluster (D-11 + Claude discretion: repeat for Excel readability)
    sections.push(header)

    // Data rows (reuse getNodeEntries pattern)
    const entries = getNodeEntries(sizing)
    for (const e of entries) {
      sections.push(
        `${e.label},${e.spec.count},${e.spec.vcpu},${e.spec.ramGB},${e.spec.storageGB}`,
      )
    }

    // RHOAI overhead row if present
    if (sizing.rhoaiOverhead) {
      sections.push(
        `RHOAI Overhead (KServe / DS Pipelines / Model Registry),—,+${sizing.rhoaiOverhead.vcpu},+${sizing.rhoaiOverhead.ramGB},—`,
      )
    }

    // Blank row separator between clusters (D-11)
    sections.push('')
  }

  // Remove last blank separator before aggregate (D-11: "except before aggregate")
  if (sections.length > 0 && sections[sections.length - 1] === '') {
    sections.pop()
  }

  // Aggregate totals row (D-10)
  sections.push(
    `AGGREGATE TOTAL,,${aggregateTotals.vcpu},${aggregateTotals.ramGB},${aggregateTotals.storageGB}`,
  )

  return sections.join('\n')
}

export function generateCsvReport(): void {
  const input = useInputStore()
  const calc = useCalculationStore()

  if (input.clusters.length >= 2) {
    // Multi-cluster path
    const clusterSizings = calc.clusterResults.map((r) => r.sizing)
    const csv = buildMultiClusterCsvContent(
      input.clusters,
      clusterSizings,
      calc.aggregateTotals,
    )
    const filename = `os-sizer-all-clusters-${new Date().toISOString().split('T')[0]}.csv`
    downloadBlob(csv, filename, 'text/csv; charset=utf-8')
  } else {
    // Single-cluster path (existing behavior unchanged)
    const clusterIdx = input.activeClusterIndex
    const cluster = input.clusters[clusterIdx] ?? input.clusters[0]
    const result = calc.clusterResults[clusterIdx] ?? calc.clusterResults[0]
    const csv = buildCsvContent(result.sizing)
    const filename = `os-sizer-${cluster.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`
    downloadBlob(csv, filename, 'text/csv; charset=utf-8')
  }
}
