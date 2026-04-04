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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Tests | Efficiency Notes |
|-----------|--------|-------|-------|-----------------|
| v1.0 | 8 | 26 | 186 | First milestone; branch divergence issue resolved mid-session |

### Recurring Patterns

- TDD-first engine development: catches real integration gaps, not just unit correctness
- Gap closure phases at end of milestone: clean audit trail, focused fixes

---
*Created: 2026-04-01 after v1.0 milestone*
