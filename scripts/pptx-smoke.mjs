#!/usr/bin/env node
/**
 * Contract smoke test for the PPTX library.
 *
 * src/composables/__tests__/usePptxExport.test.ts covers only the pure
 * data-mapping helpers — it never imports the library, so it stays green even
 * if the library is broken or swapped for an incompatible one. This script
 * exercises the exact API surface generatePptxReport() relies on.
 *
 * It lives outside vitest on purpose: pptxgenjs-plus lazily loads Node builtins
 * via `Function('s', 'return import(s)')`, which vitest's VM cannot service
 * (ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING). Under plain node it works fine.
 */
const { default: PptxGenJS } = await import('pptxgenjs-plus')

const pptx = new PptxGenJS()
pptx.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial' }
pptx.layout = 'LAYOUT_WIDE'
pptx.author = 'OpenShift Sizer'
pptx.subject = 'OpenShift Sizing Report'
pptx.title = 'Contract smoke'

const slide = pptx.addSlide()
slide.addText('hello', { x: 0.5, y: 0.5, fontSize: 18, bold: true, color: '363636' })
slide.addTable(
  [
    [{ text: 'a' }, { text: 'b' }],
    [{ text: '1' }, { text: '2' }],
  ],
  { x: 0.5, y: 1.5, w: 6 },
)
slide.addChart(pptx.ChartType.bar, [{ name: 'vCPU', labels: [['c1', 'c2']], values: [4, 8] }], {
  x: 0.5,
  y: 3,
  w: 6,
  h: 3,
})

// A .pptx is a zip: valid output starts with the PK local-file-header magic.
const buf = await pptx.write({ outputType: 'nodebuffer' })
const signature = buf.subarray(0, 2).toString('latin1')

if (pptx.layout !== 'LAYOUT_WIDE' || signature !== 'PK' || buf.length < 5000) {
  console.error(`FAIL: layout=${pptx.layout} signature=${signature} bytes=${buf.length}`)
  process.exit(1)
}
console.log(`OK: valid pptx, ${buf.length} bytes`)
