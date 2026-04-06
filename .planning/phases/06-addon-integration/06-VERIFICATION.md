---
phase: 06-addon-integration
verified: 2026-03-31T00:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Toggle ODF in Step 3 workload form, navigate to Step 4 Results"
    expected: "BomTable shows a 'ODF Storage Nodes' row with count=3, vcpu=16, ramGB=64"
    why_human: "Requires running browser UI; BomTable rendering is conditional on non-null odfNodes but visual confirmation needs a real session"
  - test: "Enter a value in the Max Nodes input (Step 1), advance to Step 3 and observe recommendation ranking"
    expected: "Recommendation engine node-budget scoring filters topologies that exceed the entered maxNodes value"
    why_human: "Recommendation scoring logic requires UI interaction and observation of ranked output change"
---

# Phase 06: Add-on Integration Verification Report

**Phase Goal:** Wire ODF and RHACM add-on sizing into the calcCluster dispatcher, add maxNodes UI input, and surface add-on nodes in all results/exports — closing the silent drop gap where odfEnabled/rhacmEnabled toggles had no effect on sizing output.
**Verified:** 2026-03-31
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When odfEnabled is true, calcCluster() returns non-null odfNodes with count=3 | VERIFIED | calculators.ts line 396: `sizing.odfNodes = calcODF(config.addOns.odfExtraOsdCount)`; test at line 400-415 asserts count=3, vcpu=16, ramGB=64; 39/39 calculator tests pass |
| 2 | When rhacmEnabled is true, calcCluster() returns non-null rhacmWorkers with count=3 | VERIFIED | calculators.ts line 399: `sizing.rhacmWorkers = calcRHACM(config.addOns.rhacmManagedClusters)`; tests at lines 435-465 cover small (vcpu=8) and large (vcpu=16) tiers |
| 3 | ODF and RHACM node resources are included in ClusterSizing.totals | VERIFIED | calculators.ts lines 403-411: `sumTotals([masterNodes, workerNodes, infraNodes, odfNodes, rhacmWorkers])` called when any add-on enabled; test at line 468-488 asserts exact totals.vcpu value |
| 4 | maxNodes number input is visible in Step1EnvironmentForm and writes to inputStore | VERIFIED | Step1EnvironmentForm.vue line 29: `const maxNodes = clusterField('maxNodes')`; template lines 161-178: `id="max-nodes-input"`, `type="number"`, @input handler converts empty→null, non-empty→Number(); inputStore.updateCluster() uses Object.assign(cluster, patch) accepting Partial<ClusterConfig> |
| 5 | All 4 locales have maxNodes label and placeholder keys | VERIFIED | en.json lines 76-78: maxNodes/maxNodesPlaceholder/maxNodesHint; fr.json lines 76-78 with nœuds ligature; de.json lines 76-78 with für umlaut; it.json lines 76-78 — all 3 keys present in all 4 locales |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/engine/calculators.ts` | Post-dispatch add-on augmentation in calcCluster() | VERIFIED | 415 lines; imports calcODF/calcRHACM from ./addons; post-dispatch block at lines 393-413 with conditional assignments and totals recalculation |
| `src/engine/calculators.test.ts` | Tests for ODF/RHACM dispatch integration | VERIFIED | 504 lines; `describe('calcCluster add-on dispatch')` at line 399 with 6 tests covering odfEnabled, odfExtraOsdCount scaling, rhacmEnabled small/large tiers, both-enabled totals, false-regression |
| `src/components/wizard/Step1EnvironmentForm.vue` | maxNodes number input field | VERIFIED | 193 lines; `const maxNodes = clusterField('maxNodes')` at line 29; `<input id="max-nodes-input" type="number">` at lines 165-173 |
| `src/i18n/locales/en.json` | maxNodes i18n keys | VERIFIED | maxNodes, maxNodesPlaceholder, maxNodesHint present in environment object |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/engine/calculators.ts` | `src/engine/addons.ts` | `import { calcODF, calcRHACM } from './addons'` | WIRED | Line 6 import confirmed; calcODF called at line 396, calcRHACM at line 399 |
| `src/engine/calculators.ts` | `src/engine/types.ts` | ClusterSizing.odfNodes and .rhacmWorkers assignment | WIRED | `sizing.odfNodes =` at line 396; `sizing.rhacmWorkers =` at line 399; both fields declared in ClusterSizing interface in types.ts |
| `src/components/wizard/Step1EnvironmentForm.vue` | `src/stores/inputStore.ts` | `clusterField('maxNodes')` computed binding | WIRED | clusterField() at line 13-23 creates computed with get/set; set calls `input.updateCluster(c.id, { maxNodes: val })`; updateCluster uses Object.assign(cluster, patch) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `BomTable.vue` | `s.odfNodes` | calcCluster() via calculationStore | Yes — calcODF() returns NodeSpec with real computed values; BomTable lines 18-19 conditionally push entries when non-null | FLOWING |
| `BomTable.vue` | `s.rhacmWorkers` | calcCluster() via calculationStore | Yes — calcRHACM() returns tiered NodeSpec; BomTable line 19 conditional push | FLOWING |
| `Step1EnvironmentForm.vue` | `maxNodes` | clusterField('maxNodes') → inputStore.clusters[activeClusterIndex].maxNodes | Yes — two-way computed binding reads from and writes to live Pinia store ref | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 39 calculator tests pass (including 6 add-on dispatch tests) | `npx vitest run src/engine/calculators.test.ts` | PASS (39) FAIL (0) | PASS |
| Full test suite 123 tests pass (117 original + 6 new) | `npx vitest run` | PASS (123) FAIL (0) | PASS |
| calcODF and calcRHACM imported and used in calcCluster | `grep -n 'calcODF\|calcRHACM' calculators.ts` | 5 matches: import at line 6, doc comment lines 376-377, usage at lines 396 and 399 | PASS |
| maxNodes binding and input element present | `grep -n 'clusterField.*maxNodes\|max-nodes-input' Step1EnvironmentForm.vue` | line 29 (binding), lines 162 and 166 (input) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ENG-07 | 06-01 | ODF add-on sizing: 16 vCPU / 64 GB x 3 storage nodes; +2 CPU/+5 GB per OSD | SATISFIED | calcODF() in addons.ts: ODF_MIN_CPU_PER_NODE=16, ODF_MIN_RAM_PER_NODE_GB=64, ODF_MIN_NODES=3; calcCluster() calls calcODF when odfEnabled; tests verify base and scaled values |
| ENG-08 | 06-01 | RHACM hub sizing: 3 workers x 16 vCPU / 64 GB (handles ~500 clusters) | SATISFIED | calcRHACM() in addons.ts: returns 3-node pool; large tier (>=100 clusters) = 16 vCPU/64 GB; calcCluster() calls calcRHACM when rhacmEnabled; tests verify both tiers |
| REC-02 | 06-01 | Constraints that drive recommendations include node budget (maxNodes) | SATISFIED | ClusterConfig.maxNodes in types.ts; clusterField('maxNodes') binding in Step1EnvironmentForm writes to inputStore; recommendation engine can now read maxNodes from active cluster config |
| FORM-05 | 06-01 | Optional add-ons toggle: ODF storage, infra nodes, GPU nodes, RHACM hub | SATISFIED | odfEnabled/rhacmEnabled toggles in Step3 workload form now produce actual sizing output via calcCluster post-dispatch augmentation |
| RES-01 | 06-01 | On-screen Bill of Materials table: node type, count, vCPU, RAM, storage per node type | SATISFIED | BomTable.vue lines 18-19: conditional push of odfNodes/rhacmWorkers entries; entries render as table rows when non-null |
| RES-05 | 06-01 | ODF nodes displayed as separate line item when enabled | SATISFIED | BomTable.vue line 18: `if (s.odfNodes) entries.push({ labelKey: 'node.storage', spec: s.odfNodes })`; charts also conditionally include odfNodes in VcpuChart, RamChart, StorageChart |

All 6 requirement IDs declared in PLAN frontmatter are accounted for. No orphaned requirements detected for Phase 6 in REQUIREMENTS.md traceability table.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TODO/FIXME/placeholder/stub patterns found | — | — |

Scan results: No empty returns, no hardcoded empty arrays/objects in data-serving code paths, no console.log-only handlers, no stub indicators in any of the 7 modified files.

### Human Verification Required

#### 1. ODF Nodes Rendered in BomTable

**Test:** Enable ODF toggle in Step 3 (workload form), click Calculate/Next to reach Step 4 Results.
**Expected:** BomTable displays a "ODF Storage Nodes" row with count=3, vcpu=16, ramGB=64, storageGB=0.
**Why human:** BomTable's conditional rendering (`if (s.odfNodes)`) is wired correctly in code, but rendering confirmation requires a live browser session.

#### 2. maxNodes Input Activates Recommendation Scoring

**Test:** Enter a value of 5 in the Maximum Node Budget field in Step 1, proceed to Step 3 Architecture Selection.
**Expected:** Topologies requiring more than 5 nodes (e.g., Standard HA with many workers) are ranked lower or filtered from recommendations.
**Why human:** Recommendation scoring logic is separate from this phase's implementation; the maxNodes field is now settable but the downstream effect on scoring output requires interactive observation.

### Gaps Summary

No gaps. All 5 must-have truths are verified at all four levels (exists, substantive, wired, data flowing). All 6 requirement IDs are satisfied with direct code evidence. The test suite confirms 123/123 tests pass including the 6 new add-on dispatch tests added in this phase.

The phase goal is fully achieved: the silent-drop gap where odfEnabled/rhacmEnabled had no effect on sizing output is closed. calcCluster() now populates odfNodes and rhacmWorkers post-dispatch, recalculates totals, and the existing BomTable/charts/exports consume the data automatically via conditional rendering that was already in place.

---

_Verified: 2026-03-31_
_Verifier: Claude (gsd-verifier)_
