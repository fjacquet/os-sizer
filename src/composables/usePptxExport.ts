// PPTX export composable — generates OpenShift sizing report as .pptx browser download
// Plain TypeScript — NO Vue lifecycle hooks
// pptxgenjs dynamically imported to keep out of main bundle

import { useInputStore } from '@/stores/inputStore'
import { useCalculationStore } from '@/stores/calculationStore'
import type { ClusterConfig, ClusterSizing, NodeSpec } from '@/engine/types'

// Local types — avoid importing pptxgenjs types directly (dynamic import pattern)
interface TableCell {
  text: string
  options?: {
    bold?: boolean
    fill?: { color: string }
    color?: string
    align?: 'left' | 'center' | 'right'
    fontSize?: number
  }
}
type TableRow = TableCell[]

// ── Color constants (bare hex, NO # prefix) ──────────────────────────────────
const RH_RED = 'EE0000'
const HEADER_BG = 'E8E8E8'
const WHITE = 'FFFFFF'

// ── Pure data-mapping helpers (testable without pptxgenjs) ───────────────────

type SummaryRow = { label: string; value: string }

export function buildArchSummaryData(
  cluster: ClusterConfig,
  totals: ClusterSizing['totals'],
): SummaryRow[] {
  return [
    { label: 'Topology', value: cluster.topology },
    { label: 'Environment', value: cluster.environment },
    { label: 'HA Required', value: cluster.haRequired ? 'Yes' : 'No' },
    { label: 'Total vCPU', value: String(totals.vcpu) },
    { label: 'Total RAM (GB)', value: String(totals.ramGB) },
    { label: 'Total Storage (GB)', value: String(totals.storageGB) },
  ]
}

function hdrCell(text: string): TableCell {
  return { text, options: { bold: true, fill: { color: HEADER_BG }, color: '000000' } }
}

function cell(text: string): TableCell {
  return { text }
}

export function buildBomTableRows(sizing: ClusterSizing): TableRow[] {
  const header: TableRow = [
    hdrCell('Node Type'),
    hdrCell('Count'),
    hdrCell('vCPU'),
    hdrCell('RAM (GB)'),
    hdrCell('Storage (GB)'),
  ]
  type NodeEntry = { label: string; spec: NodeSpec }
  const entries: NodeEntry[] = [
    { label: 'Control Plane', spec: sizing.masterNodes },
    ...(sizing.workerNodes ? [{ label: 'Workers', spec: sizing.workerNodes }] : []),
    ...(sizing.infraNodes ? [{ label: 'Infra Nodes', spec: sizing.infraNodes }] : []),
    ...(sizing.odfNodes ? [{ label: 'ODF Storage', spec: sizing.odfNodes }] : []),
    ...(sizing.rhacmWorkers ? [{ label: 'RHACM Hub', spec: sizing.rhacmWorkers }] : []),
    ...(sizing.virtWorkerNodes ? [{ label: 'Virt Workers', spec: sizing.virtWorkerNodes }] : []),
    ...(sizing.gpuNodes ? [{ label: 'GPU Nodes', spec: sizing.gpuNodes }] : []),
  ]
  const dataRows: TableRow[] = entries.map((e) => [
    cell(e.label),
    cell(String(e.spec.count)),
    cell(String(e.spec.vcpu)),
    cell(String(e.spec.ramGB)),
    cell(String(e.spec.storageGB)),
  ])
  const rhoaiRows: TableRow[] = sizing.rhoaiOverhead
    ? [
        [
          cell('RHOAI Overhead (KServe / DS Pipelines / Model Registry)'),
          cell('—'),
          cell(`+${sizing.rhoaiOverhead.vcpu}`),
          cell(`+${sizing.rhoaiOverhead.ramGB}`),
          cell('—'),
        ],
      ]
    : []
  return [header, ...dataRows, ...rhoaiRows]
}

// ── Chart data helpers (pure, testable, no pptxgenjs import) ─────────────────

// Local chart data type (mirrors pptxgenjs series shape — no pptxgenjs import needed)
export interface PptxChartSeries {
  name: string
  labels: string[]
  values: number[]
}

// Private helper — inline version of useChartData.buildChartRows
// Kept here to avoid circular imports and maintain pure-function testability
function buildChartRowsSync(sizing: ClusterSizing): Array<{ label: string; spec: NodeSpec }> {
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

/**
 * Builds pptxgenjs series data for the node count vertical bar chart.
 * Zero-count pools are excluded (success criterion 4).
 * Returns a single-series array: [{name, labels, values}]
 */
export function buildNodeCountChartData(sizing: ClusterSizing): PptxChartSeries[] {
  const nonZeroRows = buildChartRowsSync(sizing).filter((r) => r.spec.count > 0)
  return [
    {
      name: 'Node Count',
      labels: nonZeroRows.map((r) => r.label),
      values: nonZeroRows.map((r) => r.spec.count),
    },
  ]
}

/**
 * Returns true when 3 or more distinct non-zero pool types are present (PPTX-03 trigger).
 */
export function shouldShowVcpuChart(sizing: ClusterSizing): boolean {
  return buildChartRowsSync(sizing).filter((r) => r.spec.count > 0).length >= 3
}

/**
 * Builds pptxgenjs series data for the stacked vCPU bar chart.
 * Returns one series per non-zero pool (each series has a single x-axis label "vCPU").
 * Returns null when fewer than 3 non-zero pool types exist (PPTX-03 guard).
 *
 * Chart pattern: one series per pool, x-axis label = "vCPU Distribution",
 * produces a single stacked column where legend entries = pool names.
 */
export function buildVcpuStackedChartData(sizing: ClusterSizing): PptxChartSeries[] | null {
  const nonZeroRows = buildChartRowsSync(sizing).filter((r) => r.spec.count > 0)
  if (nonZeroRows.length < 3) return null
  return nonZeroRows.map((r) => ({
    name: r.label,
    labels: ['vCPU Distribution'],
    values: [r.spec.count * r.spec.vcpu],
  }))
}

// ── Main export function ──────────────────────────────────────────────────────

export async function generatePptxReport(): Promise<void> {
  const input = useInputStore()
  const calc = useCalculationStore()
  const clusterIdx = input.activeClusterIndex
  const cluster = input.clusters[clusterIdx] ?? input.clusters[0]
  const result = calc.clusterResults[clusterIdx] ?? calc.clusterResults[0]
  const sizing = result.sizing

  // Dynamic import — pptxgenjs stays out of main bundle
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pptx = new PptxGenJS()

  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'OpenShift Sizer'
  pptx.subject = 'OpenShift Sizing Report'
  pptx.title = 'OpenShift Architecture — ' + cluster.name

  // ── Single consolidated slide ─────────────────────────────────────────────
  const slide = pptx.addSlide()

  // ── Title band (full width, RH_RED) ──────────────────────────────────────
  // WIDE slide: 13.33" × 7.5"
  slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.6, fill: { color: RH_RED } })
  slide.addText('OpenShift Sizing Report — ' + cluster.name, {
    x: 0.3,
    y: 0,
    w: 13.0,
    h: 0.6,
    fontSize: 20,
    bold: true,
    color: WHITE,
    valign: 'middle',
  })

  // ── KPI callout boxes strip (y: 0.65", h: 1.1") ──────────────────────────
  // 3 boxes side-by-side, each w=4.1", gap=0.18"
  // Box positions: x = 0.3, 4.58, 8.86
  const kpiBoxW = 4.1
  const kpiBoxH = 1.05
  const kpiY = 0.65
  const kpiItems: Array<{ label: string; value: string }> = [
    { label: 'Total vCPU', value: String(sizing.totals.vcpu) },
    { label: 'Total RAM (GB)', value: String(sizing.totals.ramGB) },
    { label: 'Total Storage (GB)', value: String(sizing.totals.storageGB) },
  ]
  const kpiXPositions = [0.3, 4.58, 8.86]

  kpiItems.forEach((kpi, i) => {
    const kx = kpiXPositions[i]
    // Box background
    slide.addShape('rect', {
      x: kx,
      y: kpiY,
      w: kpiBoxW,
      h: kpiBoxH,
      fill: { color: RH_RED },
      line: { color: RH_RED },
    })
    // Label row
    slide.addText(kpi.label, {
      x: kx,
      y: kpiY + 0.05,
      w: kpiBoxW,
      h: 0.3,
      fontSize: 10,
      bold: true,
      color: WHITE,
      align: 'center',
      valign: 'middle',
    })
    // Value row
    slide.addText(kpi.value, {
      x: kx,
      y: kpiY + 0.4,
      w: kpiBoxW,
      h: 0.6,
      fontSize: 22,
      bold: true,
      color: WHITE,
      align: 'center',
      valign: 'middle',
      fit: 'shrink',
    })
  })

  // ── Content area (below KPI strip at y=1.8") ─────────────────────────────
  // Left column: charts — x=0.3", w=7.0"
  // Right column: BoM table — x=7.5", w=5.63"
  const contentY = 1.8
  const contentH = 5.5 // 7.5 - 1.8 - 0.2 footer margin
  const chartX = 0.3
  const chartW = 7.0
  const tableX = 7.5
  const tableW = 5.63

  // ── Node count BAR chart (left column) ───────────────────────────────────
  // vertical bars: barDir: 'col'
  const nodeCountData = buildNodeCountChartData(sizing)
  const showVcpuChart = shouldShowVcpuChart(sizing)

  const nodeChartH = showVcpuChart ? 2.55 : contentH
  // Use a factory function — pptxgenjs mutates options objects in-place (STATE.md pitfall)
  const makeNodeChartOpts = () => ({
    x: chartX,
    y: contentY,
    w: chartW,
    h: nodeChartH,
    barDir: 'col' as const,
    showTitle: true,
    title: 'Node Count by Pool',
    showLegend: false,
    showValue: true,
    dataLabelPosition: 'outEnd' as const,
    chartColors: [RH_RED],
  })
  slide.addChart('bar', nodeCountData, makeNodeChartOpts())

  // ── Stacked vCPU chart (only when 3+ distinct non-zero pool types) ─────────
  if (showVcpuChart) {
    const vcpuData = buildVcpuStackedChartData(sizing)
    if (vcpuData) {
      // vCPU chart positioned below node count chart in left column
      // nodeChartH = 2.55 when showVcpuChart is true
      const vcpuChartY = contentY + nodeChartH + 0.1
      const vcpuChartH = contentH - nodeChartH - 0.1

      // Factory function — pptxgenjs mutates options objects in-place (STATE.md pitfall)
      const makeVcpuChartOpts = () => ({
        x: chartX,
        y: vcpuChartY,
        w: chartW,
        h: vcpuChartH,
        barDir: 'col' as const,
        barGrouping: 'stacked' as const,
        showTitle: true,
        title: 'vCPU Distribution',
        showLegend: true,
        legendPos: 'b' as const,
        showValue: false,
        chartColors: ['EE0000', 'CC0000', 'AA0000', '880000', '660000', '440000', '220000'],
      })
      slide.addChart('bar', vcpuData, makeVcpuChartOpts())
    }
  }

  // ── BoM table (right column) ──────────────────────────────────────────────
  const bomRows = buildBomTableRows(sizing)
  slide.addTable(bomRows, {
    x: tableX,
    y: contentY,
    w: tableW,
    colW: [2.0, 0.8, 0.9, 0.9, 1.03],
    border: { type: 'solid', color: 'CCCCCC', pt: 0.5 },
    fontSize: 9,
    rowH: 0.28,
  })

  // ── Download ───────────────────────────────────────────────────────────────
  const filename = `os-sizer-${cluster.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pptx`
  await pptx.writeFile({ fileName: filename })
}
