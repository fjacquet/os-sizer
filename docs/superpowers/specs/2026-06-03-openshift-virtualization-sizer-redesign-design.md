# OpenShift Virtualization Sizer — Redesign Design

**Date:** 2026-06-03
**Status:** Approved design — ready for implementation planning
**Scope:** Milestone (~5 phases)

---

## Context

os-sizer is today a **container-first** OpenShift sizer: the primary inputs are pods
(`totalPods`, `podCpuMillicores`, `podMemMiB`) and worker node size, with OpenShift
Virtualization bolted on as a secondary add-on (`calcVirt`, a `vmsPerWorker` density knob).

Many customers buy the **OpenShift Virtualization Engine (OVE)** subscription — a VM-only
entitlement that does **not** include general container-app workloads. For those customers the
container-centric flow is the wrong front door. We are reorganizing the sizer so that
**virtualization is a first-class sizing path**, grounded in current Red Hat best practice, and
reworking the PowerPoint output (structure + a calmer, less-red look).

Sibling project **presizion** (`/Users/fjacquet/Projects/presizion`) is a mature VM-centric
VMware sizing tool; its methodology (overcommit ratios, N+1, utilization-based right-sizing,
limiting-resource reporting) informs this design.

### Intended outcome

- A **mode choice up front**: *Virtualization (OVE)* or *Container platform* (today's flow).
- A VM-centric sizing engine for the virtualization mode, using best-practice CPU overcommit,
  per-VM overhead, node reservations, and N+1 redundancy.
- A restructured, executive-grade PowerPoint in an **Executive Navy** palette (red retired),
  sharing the vatlas "Midnight Executive" house style.

---

## Decisions (from brainstorming)

| # | Decision |
|---|----------|
| Framing | **Mode choice up front** — `Virtualization` vs `Container`; each shows only relevant inputs. Both stay first-class. |
| Exposed knobs | **CPU overcommit ratio** + **N+1/N+2 redundancy**. (Growth/safety headroom and memory overcommit are NOT exposed.) |
| VM input | **VM size classes** — a few rows (Small/Medium/Large × counts), each with vCPU, RAM, disk. |
| Architecture | **Approach 1** — parallel `container/` and `virtualization/` calculators over a shared core; store/wizard/PPTX branch on mode. |
| PPTX palette | **Executive Navy** — navy + gold, red fully retired; reuse vatlas Midnight-Executive palette. |
| PPTX structure | **Executive deck + per-VM-class breakdown** — title → assumptions/summary → per-cluster sizing → VM-class breakdown → aggregate. |

---

## Best-practice grounding (researched 2026-06)

These drive the engine defaults and formulas. Sources cited inline.

- **CPU overcommit** — KubeVirt `vmiCPUAllocationRatio` (HCO), **default 10**, measured **per CPU
  thread** (hyperthreading counts; "or core on non-hyperthreaded nodes"). Pod CPU request =
  `vCPUs × (1 / ratio)`, so a node with `T` allocatable threads can schedule `T × ratio` vCPUs.
  10 is the documented max; **4:1 is the conservative production starting point**; `1` = dedicated
  (no overcommit). Source: KubeVirt HCO API `vmiCPUAllocationRatio`; kubevirt.io node_overcommit.
- **Per-VM memory overhead** — `218 MiB + 8 MiB·vCPU + 0.2%·guestRAM` (+16 MiB graphics,
  +1 GiB per GPU/SR-IOV). Confirmed against current Red Hat OCP-Virt docs and KubeVirt
  `GetMemoryOverhead`. The tool's existing formula is correct; add the graphics term.
- **Node reservations** — OpenShift `system-reserved`: CPU `60m + 12m/thread` (min 500m, OCP 4.17+);
  RAM tiered (25% of first 4 GiB / 20% / 10% / 6% / 2%) — already implemented as
  `allocatableRamGB`. Plus **~2 cores/worker** for KubeVirt infra and ~2179 MiB cluster-wide.
- **Memory overcommit** — OFF by default (needs swap via wasp-agent); **not exposed** in this design.
- **N+1** standard (N+2 for large clusters): keep ≥1 full node free; headroom must cover the full
  **restart** load (failure reboots the VM elsewhere; only graceful drains live-migrate).
- **Storage** — live migration requires **RWX**; prefer Ceph RBD **Block** mode; ODF replica-3 →
  usable ≈ raw/3, and keep Ceph < ~85% full → plan **raw ≈ usable × 3 / 0.85**. **ODF is not
  included in OVE.**
- **OVE SKU** — bare-metal, licensed **per socket-pair up to 128 cores**, VM-only; containers/ODF
  need separate subscriptions. Favors **dense dual-socket nodes**; min 8 cores/worker;
  target 60–70% average CPU utilization.

---

## Section 1 — Engine & sizing model

### Data model (mode-discriminated)

`ClusterConfig` gains `mode: SizingMode`. Container mode keeps today's `workload`; virtualization
mode carries `virt`.

```ts
type SizingMode = 'container' | 'virtualization'

type VmClass = {
  id: string
  name: string        // user-editable, e.g. "Small"
  vcpu: number        // vCPUs per VM
  ramGB: number       // guest RAM per VM
  diskGB: number      // primary disk per VM
  count: number       // number of VMs in this class
}

type NodeShape = {
  physicalCores: number    // sockets × cores/socket
  threadsPerCore: number   // 2 = HT on, 1 = off (default 2)
  ramGB: number            // installed RAM per node
}

type VirtConfig = {
  vmClasses: VmClass[]
  cpuOvercommitRatio: number              // vCPU per thread; default 10, conservative 4, 1 = dedicated
  redundancy: 'none' | 'n+1' | 'n+2'      // default 'n+1'
  nodeShape: NodeShape
  storageBackend: 'odf' | 'external-rwx'
}
```

`ClusterConfig` becomes a discriminated union on `mode` (container → `workload`,
virtualization → `virt`). The existing `AddOnConfig` (ODF/RHACM/infra/GPU/RHOAI) remains shared
where relevant.

### `engine/shared/`

Extracted, mode-agnostic primitives (mostly relocating existing code):

- `allocatableRamGB(nodeRamGB)` — tiered system-reserved RAM (existing in `formulas.ts`).
- `systemReservedCpuCores(threads)` — `0.06 + 0.012·(threads−1)`-style, min 0.5 core (OCP 4.17+).
- `perVmMemoryOverheadMiB(vcpu, ramGB)` — `218 + 8·vcpu + 0.002·(ramGB·1024)` (+16 graphics).
- `KUBEVIRT_INFRA_CPU_CORES_PER_NODE = 2`, KubeVirt infra RAM constant.
- Control-plane / infra / ODF sizing helpers (reused by both modes).

### `engine/virtualization/` calculator

1. **Aggregate** across `vmClasses`:
   `totalVms`, `totalVcpu = Σ count·vcpu`, `totalGuestRamGB = Σ count·ramGB`,
   `totalOverheadRamGB = Σ count·overhead(vcpu, ramGB)`, `totalDiskGB = Σ count·diskGB`.
2. **Per-node VM capacity** (from `nodeShape` + `cpuOvercommitRatio`):
   - `threads = physicalCores × threadsPerCore`
   - `allocThreads = threads − systemReservedCpuCores(threads) − KUBEVIRT_INFRA_CPU_CORES_PER_NODE`
   - `vcpuCapacity = allocThreads × cpuOvercommitRatio`
   - `ramCapacityGB = allocatableRamGB(nodeShape.ramGB) − kubeVirtInfraRamPerNodeGB`
3. **Worker count**:
   - `byCpu = ⌈totalVcpu / vcpuCapacity⌉`
   - `byRam = ⌈(totalGuestRamGB + totalOverheadRamGB) / ramCapacityGB⌉`
   - `byDensity = ⌈totalVms / MAX_VMS_PER_NODE⌉` (sane practical cap)
   - `baseNodes = max(byCpu, byRam, byDensity, MIN_VIRT_WORKERS)`
   - `spare = {none:0, n+1:1, n+2:2}[redundancy]`; `totalWorkers = baseNodes + spare`
   - Report **limitingResource** (cpu | ram | density) and achieved metrics:
     `achievedOvercommit = totalVcpu / (baseNodes · allocThreads)`,
     `vmsPerNode = totalVms / baseNodes`, CPU/RAM utilization %.
4. **Storage**:
   - `odf` → `rawGB ≈ totalDiskGB × 3 / 0.85` (replica-3 + fullness headroom); size ODF nodes;
     flag **"ODF not included in OVE — license separately."**
   - `external-rwx` → report required usable GB + the **RWX-for-live-migration** requirement.

### Cluster output

Unchanged shape: `ClusterSizing` = 3 control-plane (bare-metal) + virt worker pool +
optional infra/ODF → `totals`. Recommendation layer defaults virtualization mode to standard-HA
bare-metal (compact-3node for tiny estates) and surfaces an **OVE node-shape hint** (dense
dual-socket, ≤128 cores/socket-pair, min 8 cores/worker).

---

## Section 2 — Wizard flow

- **New entry step: Mode** — *Virtualization (OVE)* or *Container platform*; the wizard branches.
- **Virtualization path (3 steps):**
  1. **Environment** — reuses today's environment / HA / air-gapped / max-nodes.
  2. **VM workload & node shape** — editable **VM size-classes table** (add/remove rows: name,
     vCPU, RAM, disk, count); **bare-metal node shape** (physical cores, RAM, HT on/off);
     **CPU overcommit** (segmented 1/4/10, default 10) and **redundancy** (None/N+1/N+2, default N+1).
  3. **Storage & review** — storage backend (ODF vs external RWX) → results.
- **Container path:** unchanged (Environment / Workload (pods) / Architecture).
- Multi-cluster, session save/load, URL state, and exports keep working — each cluster carries its
  own `mode`. Results page shows the new virt metrics (node count, limiting resource, achieved
  overcommit, VMs/node, utilization).

---

## Section 3 — PowerPoint (Executive Navy)

**Palette:** navy primary + gold factual accent, reusing the vatlas Midnight-Executive sRGB
palette; **red fully retired**. Fonts unchanged (Arial prose, Consolas metrics).

**Virtualization deck — 5 slide types:**
1. **Title** — navy cover, project + date, gold keyline.
2. **Assumptions & Executive Summary** — inputs (overcommit, redundancy, node shape), key totals,
   recommended node shape, **OVE licensing note**.
3. **Per-cluster sizing** — KPIs, node-pool chart, BoM table + achieved overcommit / VMs-per-node /
   utilization.
4. **VM-class breakdown** — per-class counts, vCPU/RAM/disk, and overhead contribution.
5. **Aggregate** — multi-cluster comparison (only when ≥2 clusters).

**Code reorg:** `usePptxExport.ts` → a `pptx/` folder: navy `theme.ts` + one builder per slide
(`titleSlide`, `summarySlide`, `clusterSlide`, `vmClassSlide`, `aggregateSlide`) + a deck assembler
that branches on mode. Container mode reuses slides 1/3/5 restyled to navy. PDF and CSV exports
updated to carry VM-class rows and virt metrics.

---

## Section 4 — Testing, scope & phasing

### Testing (preserves the pure-function discipline)

- **Engine** — Vitest unit tests for the virtualization calculator, shared reservations, and
  overhead, anchored to **worked examples from the research** (e.g. Red Hat's "10 × (1 GiB, 2 vCPU)
  → 11.68 GiB" overhead case; overcommit capacity; N+1; limiting-resource selection).
- **Store/validation** — mode discrimination, defaults, **versioned** session/URL schema (existing
  container sessions still load → default `mode: 'container'`).
- **Exports** — pure data-builder helpers (per-class breakdown, summary rows) tested like today;
  navy/font convention assertions.

### Scope guardrails (YAGNI — explicitly out of scope)

- RVTools / estate import.
- The memory-overcommit knob.
- Per-individual-VM modeling (size classes only).
- New GPU+virt combinations beyond what exists.

### Backward compatibility

Session/URL schema version bumps; loaders default missing `mode` to `'container'` so existing
saved sessions and shared links keep working unchanged.

### Phasing (~5 phases)

1. **Engine foundation** — `engine/shared/` extraction + new types + `engine/virtualization/`
   calculator + tests. No UI.
2. **Store & plumbing** — inputStore `mode` + virt config, calculationStore branch, validation,
   defaults, versioned session/URL schema, i18n keys (en/fr/de/it).
3. **Wizard UI** — mode entry step + virtualization Steps 2–3 + results-page virt metrics; container
   path untouched.
4. **PPTX executive deck** — `pptx/` reorg, navy theme, per-slide builders, mode-branched assembler;
   restyle container deck to navy; update PDF/CSV for virt.
5. **Docs & polish** — ADRs (overcommit model, OVE assumptions), PRD update, licensing notes,
   milestone audit.

---

## Open questions / risks

- **Density cap** (`MAX_VMS_PER_NODE`): Red Hat publishes no fixed number; we pick a sane default
  and treat CPU/RAM as the real binders. Revisit if it ever binds in practice.
- **Control-plane sizing on bare metal** for OVE: confirm masters reuse existing CP sizing or need a
  bare-metal-specific minimum during phase 1.
- **Storage realism**: the ODF raw-capacity estimate is a planning approximation, not an ODF sizing
  tool; surfaced as an estimate with the replica-3 assumption stated.
