// PDF export composable — jsPDF + jspdf-autotable, dynamically imported
// Plain TypeScript — NO Vue lifecycle hooks
import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import type { ClusterSizing, NodeSpec } from '@/engine/types'
import { buildChartRows, buildNodeCountData } from './useChartData'
import Chart from 'chart.js/auto'

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

// Pure function — testable without jsPDF
export function buildPdfTableData(sizing: ClusterSizing): {
  head: string[][]
  body: string[][]
} {
  const nodeRows = getNodeEntries(sizing).map((e) => [
    e.label,
    String(e.spec.count),
    String(e.spec.vcpu),
    String(e.spec.ramGB),
    String(e.spec.storageGB),
  ])
  const rhoaiRows: string[][] = sizing.rhoaiOverhead
    ? [
        [
          'RHOAI Overhead (KServe / DS Pipelines / Model Registry)',
          '—',
          `+${sizing.rhoaiOverhead.vcpu}`,
          `+${sizing.rhoaiOverhead.ramGB}`,
          '—',
        ],
      ]
    : []
  return {
    head: [['Node Type', 'Count', 'vCPU', 'RAM (GB)', 'Storage (GB)']],
    body: [...nodeRows, ...rhoaiRows],
  }
}

/**
 * Renders a Chart.js bar chart of node counts to an offscreen canvas.
 * Returns a PNG data URL, or null if all pools have zero count.
 * Pure function — testable without jsPDF.
 */
export function buildChartImageDataUrl(sizing: ClusterSizing): string | null {
  // Filter to non-zero rows
  const allRows = buildChartRows(sizing)
  const rows = allRows.filter((r) => r.spec.count > 0)
  if (rows.length === 0) return null

  const labels = rows.map((r) => r.label)
  const data = buildNodeCountData(rows)

  // Offscreen canvas — not mounted to DOM
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 200
  const ctx = canvas.getContext('2d')!

  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Node Count',
          data,
          backgroundColor: '#EE0000', // Red Hat red
          borderRadius: 3,
        },
      ],
    },
    options: {
      animation: { duration: 0 }, // CRITICAL: canvas captures blank without this
      responsive: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Node Count by Pool',
          font: { size: 13 },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, precision: 0 },
        },
      },
    },
  })

  const dataUrl = canvas.toDataURL('image/png')
  chart.destroy()
  return dataUrl
}

export interface KpiStripData {
  vcpu: number
  ramGB: number
  storageGB: number
  label: string
}

/**
 * Extracts KPI totals from sizing for the callout strip.
 * Pure function — testable without jsPDF.
 */
export function buildKpiStripData(sizing: ClusterSizing): KpiStripData {
  const { vcpu, ramGB, storageGB } = sizing.totals
  return {
    vcpu,
    ramGB,
    storageGB,
    label: `Total vCPU: ${vcpu}   |   RAM: ${ramGB} GB   |   Storage: ${storageGB} GB`,
  }
}

// ── Aggregate row helper (pure, testable) ─────────────────────────────────────

export function buildAggregateRow(
  aggregateTotals: { vcpu: number; ramGB: number; storageGB: number },
): string[] {
  return [
    'AGGREGATE TOTAL',
    '',
    String(aggregateTotals.vcpu),
    String(aggregateTotals.ramGB),
    String(aggregateTotals.storageGB),
  ]
}

export async function generatePdfReport(
  resolvedWarnings: { text: string; severity: 'error' | 'warning' }[] = [],
  allResolvedWarnings: { text: string; severity: 'error' | 'warning' }[][] = [],
): Promise<void> {
  const input = useInputStore()
  const calc = useCalculationStore()

  // Dynamic import — jsPDF stays out of main bundle
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  if (input.clusters.length >= 2) {
    // ── Multi-cluster path: per-cluster sections + aggregate totals row ──────
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })

    // Title page header
    doc.setFontSize(18)
    doc.setTextColor(238, 0, 0)
    doc.text('OpenShift Sizing Report', 40, 30)
    doc.setFontSize(12)
    doc.setTextColor(0, 0, 0)
    doc.text('All Clusters', 40, 50)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 40, 65)

    let currentY = 80

    for (let i = 0; i < input.clusters.length; i++) {
      const cluster = input.clusters[i]
      const result = calc.clusterResults[i]
      const sizing = result.sizing

      // Page overflow check
      if (currentY > 450) {
        doc.addPage()
        currentY = 40
      }

      // Cluster name header row (D-06): red background, white text
      doc.setFillColor(238, 0, 0)
      doc.rect(40, currentY, 760, 20, 'F')
      doc.setFontSize(12)
      doc.setTextColor(255, 255, 255)
      doc.text(cluster.name, 50, currentY + 14)
      currentY += 24

      // Chart image (D-08)
      const chartDataUrl = buildChartImageDataUrl(sizing)
      if (chartDataUrl) {
        doc.addImage(chartDataUrl, 'PNG', 40, currentY, 500, 125)
        currentY += 130
      }

      // KPI strip
      const kpi = buildKpiStripData(sizing)
      doc.setFillColor(240, 240, 240)
      doc.rect(40, currentY, 760, 22, 'F')
      doc.setFontSize(11)
      doc.setTextColor(21, 21, 21)
      doc.text(kpi.label, 50, currentY + 14)
      currentY += 27

      // BoM table
      const { head, body } = buildPdfTableData(sizing)
      autoTable(doc, {
        head,
        body,
        startY: currentY,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [238, 0, 0], textColor: 255 },
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
      currentY =
        (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ??
        currentY + 100

      // Per-cluster warnings
      const clusterWarnings = allResolvedWarnings[i]
      if (clusterWarnings && clusterWarnings.length > 0) {
        doc.setFontSize(10)
        for (const w of clusterWarnings) {
          if (w.severity === 'error') {
            doc.setTextColor(238, 0, 0)
          } else {
            doc.setTextColor(249, 115, 22)
          }
          const prefix = w.severity === 'error' ? '! ' : '> '
          doc.text(`${prefix}${w.text}`, 40, currentY + 14)
          currentY += 14
        }
        doc.setTextColor(0, 0, 0)
      }

      // Gap before next cluster
      currentY += 15
    }

    // Aggregate totals section (D-07)
    if (currentY > 500) {
      doc.addPage()
      currentY = 40
    }
    const aggRow = buildAggregateRow(calc.aggregateTotals)
    autoTable(doc, {
      head: [['AGGREGATE TOTAL', '', 'vCPU', 'RAM (GB)', 'Storage (GB)']],
      body: [[aggRow[0], aggRow[1], aggRow[2], aggRow[3], aggRow[4]]],
      startY: currentY,
      headStyles: { fillColor: [238, 0, 0], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 11 },
    })

    const filename = `os-sizer-all-clusters-${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(filename)
  } else {
    // ── Single-cluster path (D-01): identical to Phase 17 baseline ───────────
    const clusterIdx = input.activeClusterIndex
    const cluster = input.clusters[clusterIdx] ?? input.clusters[0]
    const result = calc.clusterResults[clusterIdx] ?? calc.clusterResults[0]
    const { head, body } = buildPdfTableData(result.sizing)

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })

    // Title
    doc.setFontSize(18)
    doc.setTextColor(238, 0, 0)
    doc.text('OpenShift Sizing Report', 40, 30)
    doc.setFontSize(12)
    doc.setTextColor(0, 0, 0)
    doc.text(cluster.name, 40, 50)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 40, 65)

    // Chart image (PDF-01)
    let tableStartY = 80
    const chartDataUrl = buildChartImageDataUrl(result.sizing)
    if (chartDataUrl) {
      doc.addImage(chartDataUrl, 'PNG', 40, 80, 500, 125)
      tableStartY = 210
    }

    // KPI summary strip (PDF-02)
    const kpi = buildKpiStripData(result.sizing)
    const kpiY = tableStartY + 5
    doc.setFillColor(240, 240, 240)
    doc.rect(40, kpiY, 760, 22, 'F')
    doc.setFontSize(11)
    doc.setTextColor(21, 21, 21)
    doc.text(kpi.label, 50, kpiY + 14)
    tableStartY = kpiY + 27

    // Bill of Materials table
    autoTable(doc, {
      head,
      body,
      startY: tableStartY,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [238, 0, 0], textColor: 255 },
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

    // Inline validation warnings (PDF-04)
    if (resolvedWarnings.length > 0) {
      let warnY = finalY + 35
      doc.setFontSize(10)
      for (const w of resolvedWarnings) {
        if (w.severity === 'error') {
          doc.setTextColor(238, 0, 0)
        } else {
          doc.setTextColor(249, 115, 22)
        }
        const prefix = w.severity === 'error' ? '! ' : '> '
        doc.text(`${prefix}${w.text}`, 40, warnY)
        warnY += 14
      }
      doc.setTextColor(0, 0, 0)
    }

    const filename = `os-sizer-${cluster.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(filename)
  }
}
