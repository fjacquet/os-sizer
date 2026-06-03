// PPTX styling tokens — mirrors vatlas/src/engines/export/pptx/theme.ts.
// Pure const module (no Vue): fonts + brand colors for the sizing deck.
// Brand: Red Hat. Fonts: Arial (text) + Consolas (numeric/metric values, tabular idiom).

export const PPTX_FONT = {
  /** All prose: titles, KPI labels, table label cells, chart titles/axes/legend. */
  body: 'Arial',
  /** Numeric/metric values: KPI numbers, table data cells, chart data labels. */
  metric: 'Consolas',
} as const

// Bare hex (NO # prefix) — pptxgenjs convention. Executive Navy palette (shared with vatlas).
export const PPTX_COLORS = {
  navy: '1E2761', // title bands, KPI fills, primary chart series
  navyLight: '5566C9',
  gold: 'F9B935', // factual accent (never a verdict colour)
  headerBg: 'E8ECF7', // light navy tint for table headers
  white: 'FFFFFF',
  black: '0F172A', // ink
  border: 'CBD5E1',
  /** Navy chart series (darkening → lightening navy/blue). */
  series: ['1E2761', '3245B7', '5566C9', '819AE9', 'B0C2F9', 'CDD9F5', 'E3EAFC'],
} as const
