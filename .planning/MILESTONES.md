# Milestones

## v2.0 OpenShift Virtualization + AI Sizing (Shipped: 2026-04-04)

**Phases completed:** 4 phases, 15 plans, 17 tasks
**Git range:** v1.0..HEAD | **Files:** 103 changed | **LOC:** ~6,400 TypeScript/Vue | **Tests:** 256 passing
**Timeline:** 2026-04-01 → 2026-04-04 (3 days)

**Key accomplishments:**

1. `calcVirt()` three-constraint formula (density/RAM/CPU + live-migration reserve) with KubeVirt per-node overhead (2 vCPU, 218 MiB + per-VM RAM) wired into `calcCluster()` post-dispatch
2. SNO-with-Virt profile enforcing 14 vCPU / 32 GB / 170 GB minimums + recommendation engine +25 virt boost
3. `calcGpuNodes()` with hardware minimum enforcement, MIG profile lookup (A100/H100), WARN-01 (passthrough blocks migration) and WARN-03 (MIG+KubeVirt unsupported) validation warnings
4. `calcRHOAI()` worker floor (8 vCPU/32 GB Math.max) + infra addend (+4 vCPU/+16 GB) enforced via post-dispatch mutation
5. All 9 Phase-12 requirements surfaced in wizard UI (Step2/Step3), visible in BoM table, and exported in all 3 formats (CSV/PPTX/PDF) across 4 locales (EN/FR/DE/IT)
6. Test suite grew from 186 (v1.0) to 256 passing tests with zero regressions

---

## v1.0 Full OpenShift Sizer (Shipped: 2026-04-01)

**Phases completed:** 8 phases, 26 plans, 26 tasks

**Key accomplishments:**

- 1. [Rule 1 - Bug] TypeScript 6.0 baseUrl deprecation error
- Three Pinia store skeletons with TypeScript-typed ClusterConfig/SizingResult engine contracts, ref-only input state, computed-only calculation state, and 11 passing TDD tests.
- vue-i18n configured with 4 Swiss locales (EN/FR/DE/IT), lazy-loading via explicit if/else branches, LanguageSwitcher in App.vue header, and Vite 8 rolldown build clean
- One-liner:
- Four pure formula functions with decimal.js precision: CP/infra table lookup and tiered RAM reservation and worker count via max(byCpu, byRam, byPods, 2)
- One-liner:
- 1. [Rule 1 - Implementation Detail] aria-current binding approach
- 1. [Rule 1 - Bug] Fixed pervasive accent/umlaut inconsistency across all 3 non-EN locales
- One-liner:
- Static GitHub Pages deployment via GitHub Actions — .nojekyll bypass + /os-sizer/ base path + upload-pages-artifact/deploy-pages two-step workflow
- One-liner:
- 1. WorkloadSchema exists — used real schema tests
- Three surgical calcHCP fixes: allocatableRamGB formula replaces hardcoded 28.44, Math.max guards enforce WORKER_MIN, and infraNodes branch enables HCP infra node support — all driven by TDD (186 tests passing)

---
