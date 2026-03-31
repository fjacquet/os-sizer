---
phase: 1
slug: project-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.2 |
| **Config file** | `vitest.config.ts` (copied from vcf-sizer) |
| **Quick run command** | `npm run type-check` |
| **Full suite command** | `npm run test && npm run lint && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run type-check`
- **After every plan wave:** Run `npm run test && npm run lint && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | SETUP-01 | smoke | `npm run dev` (manual) | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | SETUP-02 | lint | `npm run lint` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | SETUP-03 | smoke | `npm run test` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 2 | SETUP-05 | type-check | `npm run type-check` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 2 | SETUP-05 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 3 | SETUP-04 | smoke | `npm run dev` (manual) | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 3 | I18N-07 | build | `npm run build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — required before any test can run (copy from vcf-sizer)
- [ ] `src/stores/inputStore.test.ts` — stubs for SETUP-05 store ref pattern
- [ ] `src/stores/uiStore.test.ts` — covers locale detection and setLocale
- [ ] `src/stores/calculationStore.test.ts` — covers computed-only pattern

*Wave 0 must create these before any other tasks run.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `npm run dev` starts without errors | SETUP-01 | Requires browser/server process | Run `npm run dev`, verify localhost opens, no console errors |
| Language switcher cycles EN/FR/IT/DE | SETUP-04, I18N-01–06 | Requires browser interaction | Open app, click language switcher, verify all 4 languages render UI in correct language |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
