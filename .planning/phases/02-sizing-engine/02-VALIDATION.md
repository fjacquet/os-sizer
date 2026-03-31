---
phase: 2
slug: sizing-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` |
| **Environment** | `node` (no DOM — enforces zero Vue imports in engine) |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** `npm run test`
- **After every plan wave:** `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 02-01 | 1 | ENG-01 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02-02 | 2 | ENG-02 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02-02 | 2 | ENG-03, ENG-04 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 2-02-03 | 02-02 | 2 | ENG-05 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 2-03-01 | 02-03 | 3 | ENG-06, QA-05 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 2-04-01 | 02-04 | 4 | ENG-07, ENG-08 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 2-05-01 | 02-05 | 5 | REC-01, REC-02, REC-03 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 2-06-01 | 02-06 | 6 | ENG-09, QA-01, QA-02 | unit | `npm run test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/engine/formulas.test.ts` — stubs for ENG-02, ENG-03, ENG-04, ENG-05
- [ ] `src/engine/calculators.test.ts` — stubs for ENG-06, QA-05 (minimums enforcement)
- [ ] `src/engine/addons.test.ts` — stubs for ENG-07, ENG-08
- [ ] `src/engine/recommendation.test.ts` — stubs for REC-01, REC-02, REC-03, QA-02
- [ ] `src/engine/validation.test.ts` — stubs for ENG-09 (no Vue imports)

*Wave 0 must be created in Plan 02-01 before any implementation plans run.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SNO "edge" profile 8vCPU/32GB decision | ENG-06 | Project decision, no official RH spec | Confirm in STATE.md before Plan 02-03 |

---

## Known Test Values (for acceptance criteria)

| Formula | Input | Expected Output |
|---------|-------|-----------------|
| `cpSizing(24)` | 24 workers | 4 vCPU / 16 GB |
| `cpSizing(120)` | 120 workers | 8 vCPU / 32 GB |
| `cpSizing(252)` | 252 workers | 16 vCPU / 64 GB |
| `cpSizing(501)` | 501 workers | 16 vCPU / 96 GB |
| `allocatableRamGB(8)` | 8 GB node | ≈ 6.2 GB |
| `allocatableRamGB(16)` | 16 GB node | ≈ 12.4 GB |
| `allocatableRamGB(32)` | 32 GB node | ≈ 28.4 GB |
| `infraNodeSizing(27)` | 27 workers | 4 vCPU / 24 GB |
| `infraNodeSizing(120)` | 120 workers | 8 vCPU / 48 GB |
| `infraNodeSizing(252)` | 252 workers | 16 vCPU / 128 GB |
| `calcOdf(1)` | 1 extra OSD | 3 nodes × 16 vCPU / 64 GB |
| `calcOdf(2)` | 2 extra OSDs | 3 nodes × 18 vCPU / 69 GB |
| `calcRhacm(100)` | 100 clusters | 3 × 16 vCPU / 64 GB |
| `calcRhacm(50)` | 50 clusters | 3 × 8 vCPU / 32 GB |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
