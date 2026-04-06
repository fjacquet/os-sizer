---
phase: 13
slug: foundation-infrastructure
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-04
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (installed, vitest.config.ts at project root) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `rtk vitest run` |
| **Full suite command** | `rtk vitest run --reporter=verbose` |
| **Estimated runtime** | ~3 seconds (256 tests baseline) |

---

## Sampling Rate

- **After every task commit:** Run `rtk vitest run`
- **After every plan wave:** Run `rtk vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Criterion | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-----------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 0 | SC-1 (downloadBlob unit) | unit | `rtk vitest run src/composables/__tests__/download.test.ts` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 0 | SC-2 (useChartData unit) | unit | `rtk vitest run src/composables/__tests__/useChartData.test.ts` | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 1 | SC-1 + SC-2 extraction | unit+regression | `rtk vitest run` | ✅ | ⬜ pending |
| 13-02-01 | 02 | 0 | SC-4 (aggregateTotals unit) | unit | `rtk vitest run src/stores/__tests__/calculationStore.test.ts` | ❌ W0 | ⬜ pending |
| 13-02-02 | 02 | 1 | SC-3 (role field) + SC-4 | type+unit | `rtk tsc --noEmit && rtk vitest run` | ✅ | ⬜ pending |
| 13-02-03 | 02 | 1 | CALC-02 compliance | static | `grep -n "ref(" src/stores/calculationStore.ts \| grep -v "computed\|//\|'ref'"` | ✅ | ⬜ pending |
| 13-final | — | gate | SC-5 (256 tests pass) | regression | `rtk vitest run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/composables/__tests__/download.test.ts` — unit tests for `downloadBlob`: export exists, calls `URL.createObjectURL`, mocks blob URL, triggers anchor click
- [ ] `src/composables/__tests__/useChartData.test.ts` — unit tests for `buildChartRows`, `buildVcpuData`, `buildRamData`, `buildStorageData`, `buildNodeCountData` with a minimal `ClusterSizing` fixture; assert no Vue import in the module itself
- [ ] `src/stores/__tests__/calculationStore.test.ts` (additions) — tests for `aggregateTotals`: 1-cluster sum, 2-cluster sum, 3-cluster sum, empty clusters → zero totals

*Existing `useCsvExport.test.ts` covers SC-1b (regression after extraction).*

---

## Manual-Only Verifications

| Behavior | Criterion | Why Manual | Test Instructions |
|----------|-----------|------------|-------------------|
| CALC-02 static check | SC-4b | grep result must be empty (no ref() in calculationStore.ts) | Run: `grep -n "ref(" src/stores/calculationStore.ts \| grep -v "computed\|//\|'ref'"` — expect no output |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-04-04
