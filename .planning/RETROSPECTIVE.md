# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.0 — Full OpenShift Sizer

**Shipped:** 2026-04-01
**Phases:** 8 | **Plans:** 26 | **Sessions:** 2

### What Was Built

- Complete Vue 3 + TypeScript sizing tool covering all 8 OpenShift topologies
- Pure TypeScript sizing engine with 186 tests (zero Vue deps in engine)
- Multi-step wizard with Zod validation, 4-locale i18n (EN/FR/IT/DE)
- Results page with BoM table, 3 chart types, URL sharing, PPTX/PDF/CSV exports
- GitHub Pages deployment with GitHub Actions CI/CD
- Gap-closure phases: ODF/RHACM add-on wiring, wizard component tests, HCP engine fixes

### What Worked

- **TDD for sizing engine**: Caught 3 real integration gaps (ENG-07, ENG-08, RES-04) during gap-closure phases. The tests proved their value.
- **Post-dispatch add-on pattern**: Clean separation of add-on sizing from topology functions; easy to extend.
- **Milestone audit before completion**: Running `/gsd:audit-milestone` first revealed the 11-gap set that became phases 6-8. Worth the overhead.
- **Gap closure as separate phases**: Kept the original phases clean and created a clear audit trail of what was fixed and why.
- **Wave-based parallel executor**: Phases with independent plans (6, 7, 8) ran cleanly in parallel concept.

### What Was Inefficient

- **Branch divergence incident**: Executor subagents committed to `main` while orchestrator was on `gsd/v1.0-milestone`. Required a merge mid-session. Root cause: branching_strategy "milestone" in config but agents defaulted to main.
- **REQUIREMENTS.md checkbox drift**: Checkboxes in requirements list were never auto-updated by executors. Had to manually fix 21 stale unchecked items at milestone close.
- **Plan checker false positives on wrong branch**: Phase 6 plan checker found 5 "blockers" that were all false positives from running on the wrong branch (no source files). Cost one full checker round-trip.
- **LSP false positives**: Several TypeScript diagnostics appeared as errors but passed `vue-tsc --noEmit` cleanly. The `@/` alias and "unused import" diagnostics were stale LSP cache issues.

### Patterns Established

- **Static contract test pattern**: For Vue components in node environment, use `setActivePinia(createPinia())` + real store mutations instead of DOM mounting. Avoids `@vue/test-utils` + jsdom overhead.
- **`vi.stubGlobal('navigator', { language: 'en' })` before `setActivePinia`**: Required pattern when stores read `navigator.language` in constructor.
- **Post-dispatch add-on augmentation**: `calcCluster()` runs topology function, then conditionally calls `calcODF()`/`calcRHACM()` and recalculates `sumTotals()`. Clean, non-intrusive.
- **VALIDATION.md from research**: Nyquist validator requires VALIDATION.md when RESEARCH.md has "## Validation Architecture" section. Create it during `plan-phase` step 5.5 — don't wait for plan-checker to block.

### Key Lessons

1. **Check current git branch before executing any phase.** The gsd-tools init returns the configured milestone branch, but subagents may default to main. Verify with `git branch --show-current` before spawning executors.
2. **REQUIREMENTS.md checkboxes ≠ traceability table.** The traceability table is authoritative for completion status; checkboxes are documentation artifacts that drift. Reconcile them at milestone close, not phase-by-phase.
3. **Milestone audit gap status is pre-gap-closure.** After executing gap-closure phases 6-8, the audit file still shows `gaps_found`. This is correct — the audit documents the state BEFORE the fix. Don't re-audit; just proceed with `complete-milestone`.
4. **Always verify `npm run type-check` before concluding LSP errors are real.** `vue-tsc` is authoritative; LSP cache lags behind actual compilation state.

### Cost Observations

- Model mix: ~80% sonnet (executors, verifiers), ~20% opus (planners)
- Sessions: 2 (initial session + context reset continuation)
- Notable: Opus planner for phases 7-8 produced well-structured TDD plans that required 0 revisions; sonnet plan checkers passed on first iteration after VALIDATION.md was added

---

---

## Milestone: v2.0 — OpenShift Virtualization + AI Sizing

**Shipped:** 2026-04-04
**Phases:** 4 | **Plans:** 15 | **Sessions:** ~3

### What Was Built

- `calcVirt()` three-constraint KubeVirt worker pool sizing (density/RAM/CPU + live-migration reserve)
- `calcGpuNodes()` with hardware minimums, MIG profile lookup (A100/H100), GPU mode support
- `calcRHOAI()` worker floor enforcement (8 vCPU/32 GB) + infra overhead (+4/+16 GB) via post-dispatch mutation
- SNO-with-Virt profile (14 vCPU/32 GB/170 GB) + recommendation engine +25 virt topology boost
- Wizard UI for all v2.0 add-ons (Step2 toggles + sub-inputs, Step3 VM sizing inputs)
- BomTable + 3 export formats (CSV/PPTX/PDF) extended with virtWorkerNodes/gpuNodes/rhoaiOverhead rows
- All new i18n keys in EN/FR/DE/IT (26 new keys + 5 deferred Phase-9 keys)
- Test suite grew from 186 → 256 passing tests (70 new tests for v2.0 add-ons, UI, exports)

### What Worked

- **Post-dispatch add-on pattern held perfectly**: `calcVirt()`, `calcGpuNodes()`, `calcRHOAI()` all used the same pattern established in v1.0 Phase 6. Zero architectural debates.
- **Null-sentinel pattern for optional rows**: `sizing.virtWorkerNodes`, `sizing.gpuNodes`, `sizing.rhoaiOverhead` as typed-or-null fields ensured all consumers (BoM, CSV, PPTX, PDF) added explicit null-guard entries. No silent omissions.
- **Phase sequencing was clean**: Engine phases (9, 10, 11) completed before UI phase (12), so UI had all types and functions available. No circular dependency issues.
- **TDD for add-ons**: Each add-on function (calcVirt, calcGpuNodes, calcRHOAI) was tested before wiring into calcCluster. Caught a RHOAI totals recalc issue during Phase 11 that would have been invisible without tests.
- **Audit before completion**: The integration checker found 4 tech debt items (SNO warning path, gpuPerNode orphan, virt sub-inputs topology gap) that are real but non-critical. Good visibility into what was accepted.

### What Was Inefficient

- **Stale `gsd/v1.0-milestone` branch**: The branch was never merged and diverged from main. Had to clean it up at the start of the next session. Cost: ~5 minutes. Root cause: milestone completion script doesn't auto-clean old milestone branches.
- **SUMMARY.md one-liner extraction**: The `gsd-tools summary-extract` command failed to extract `one_liner` fields because the Phase 9-12 SUMMARY files use a different frontmatter structure. MILESTONES.md required manual correction. The extraction tool's regex needs updating.
- **No Nyquist VALIDATION.md for v2.0 phases**: All 4 phases lacked VALIDATION.md files. Nyquist validation was never run. This was flagged by the audit. Pattern from v1.0 (create VALIDATION.md during plan-phase step 5.5) was not followed in v2.0.
- **Phase 12 plan 01 re-verification flag**: VERIFICATION.md for phase 12 had `re_verification: false` but the plan covered a type extension that changed earlier phases' behavior. Would have benefited from a targeted re-check of phase 11 after 12-01.

### Patterns Established

- **`rhoaiOverhead: { vcpu; ramGB } | null` required field pattern**: Making the field required (not optional `?`) with a null sentinel forces all consumer paths to handle the field explicitly at compile time. Apply this to future add-on output fields.
- **void mutation vs return value for post-dispatch functions**: `calcRHOAI()` returns void and mutates ClusterSizing in-place. This matches the existing pattern and keeps function signatures simple. Apply consistently to future add-ons.
- **addOnField spread-merge helper in Vue components**: `addOnField(key)` in Step2/Step3 uses `{ addOns: { ...c.addOns, [key]: val } }` to prevent sibling field wipe on update. Required pattern for all addOns fields.

### Key Lessons

1. **Clean up milestone branches immediately after /gsd:complete-milestone.** The `gsd/v{version}-milestone` branch should be deleted as part of the completion workflow. `git branch -d gsd/v{version}-milestone` — it will fail safely if there are unmerged commits.
2. **Create VALIDATION.md in plan-phase step 5.5.** The v1.0 lesson was learned but not applied in v2.0. Write it into the plan template as a required step, not an optional one.
3. **The audit's tech_debt status is the right call for missing warning display.** SNO_VIRT_NO_HA hardware minimum IS applied; only the UI advisory message is missing. Accepting as tech debt (not blocking) was correct.
4. **Three-phase engine → one-phase UI split works well for add-on feature sets.** Phases 9-11 pure engine, phase 12 pure UI/exports. Clear boundary, no UI bleeding into engine phases.

### Cost Observations

- Model mix: ~85% sonnet (executors, verifiers, integration checker), ~15% opus (planners)
- Sessions: ~3 (one per engine phase cluster, one for UI/exports phase)
- Notable: Phase 12 was the largest plan set (5 plans) but most straightforward to execute — all engine APIs were stable before UI phase started

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Tests | Efficiency Notes |
|-----------|--------|-------|-------|-----------------|
| v1.0 | 8 | 26 | 186 | First milestone; branch divergence issue resolved mid-session |
| v2.0 | 4 | 15 | 256 | Clean engine→UI phase split; post-dispatch pattern reused perfectly; Nyquist not run |

### Recurring Patterns

- TDD-first engine development: catches real integration gaps, not just unit correctness
- Gap closure phases at end of milestone: clean audit trail, focused fixes
- Post-dispatch add-on augmentation in `calcCluster()`: proven scalable (now 5 add-ons: ODF, RHACM, Virt, GPU, RHOAI)
- Milestone audit before completion: consistently surfaces non-obvious tech debt worth documenting

### Persistent Issues

- Nyquist VALIDATION.md not created during plan-phase: flagged in v1.0, repeated in v2.0 — needs to be in plan template
- MILESTONES.md one-liner extraction fails for newer SUMMARY format — tool needs updating

---
*Created: 2026-04-01 after v1.0 milestone*
*Updated: 2026-04-04 after v2.0 milestone*
