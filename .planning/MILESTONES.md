# Milestones

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
