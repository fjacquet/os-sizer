// PPTX styling tokens — mirrors vatlas/src/engines/export/pptx/theme.ts.
// Pure const module (no Vue): fonts + brand colors for the sizing deck.
// Brand: Red Hat. Fonts: Arial (text) + Consolas (numeric/metric values, tabular idiom).

export const PPTX_FONT = {
  /** All prose: titles, KPI labels, table label cells, chart titles/axes/legend. */
  body: 'Arial',
  /** Numeric/metric values: KPI numbers, table data cells, chart data labels. */
  metric: 'Consolas',
} as const

// Bare hex (NO # prefix) — pptxgenjs convention.
export const PPTX_COLORS = {
  rhRed: 'EE0000',
  headerBg: 'E8E8E8',
  white: 'FFFFFF',
  black: '000000',
  border: 'CCCCCC',
  /** Stacked vCPU chart shades (darkening reds). */
  vcpuSeries: ['EE0000', 'CC0000', 'AA0000', '880000', '660000', '440000', '220000'],
} as const
