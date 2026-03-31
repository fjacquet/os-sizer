// PDF export composable — jsPDF + jspdf-autotable, dynamically imported
// Plain TypeScript — NO Vue lifecycle hooks
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

// Pure function — testable without jsPDF
export function buildPdfTableData(sizing: ClusterSizing): {
  head: string[][]
  body: string[][]
} {
  return {
    head: [['Node Type', 'Count', 'vCPU', 'RAM (GB)', 'Storage (GB)']],
    body: getNodeEntries(sizing).map((e) => [
      e.label,
      String(e.spec.count),
      String(e.spec.vcpu),
      String(e.spec.ramGB),
      String(e.spec.storageGB),
    ]),
  }
}

export async function generatePdfReport(): Promise<void> {
  const input = useInputStore()
  const calc = useCalculationStore()
  const clusterIdx = input.activeClusterIndex
  const cluster = input.clusters[clusterIdx] ?? input.clusters[0]
  const result = calc.clusterResults[clusterIdx] ?? calc.clusterResults[0]
  const { head, body } = buildPdfTableData(result.sizing)

  // Dynamic import — jsPDF stays out of main bundle
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })

  // Title
  doc.setFontSize(18)
  doc.setTextColor(238, 0, 0) // Red Hat red
  doc.text('OpenShift Sizing Report', 40, 30)
  doc.setFontSize(12)
  doc.setTextColor(0, 0, 0)
  doc.text(cluster.name, 40, 50)
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 40, 65)

  // Bill of Materials table
  autoTable(doc, {
    head,
    body,
    startY: 80,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [238, 0, 0], textColor: 255 }, // Red Hat red header
    alternateRowStyles: { fillColor: [248, 248, 248] },
    theme: 'striped',
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 60, halign: 'center' },
      2: { cellWidth: 60, halign: 'center' },
      3: { cellWidth: 80, halign: 'center' },
      4: { cellWidth: 100, halign: 'center' },
    },
  })

  // Summary footer
  const totals = result.sizing.totals
  const finalY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 200
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(
    `Total: ${totals.vcpu} vCPU | ${totals.ramGB} GB RAM | ${totals.storageGB} GB Storage`,
    40,
    finalY + 20,
  )

  const filename = `os-sizer-${cluster.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
