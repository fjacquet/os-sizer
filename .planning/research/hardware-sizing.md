# OpenShift Hardware Sizing Research

**Project:** os-sizer — Pre-sales OpenShift sizing tool
**Researched:** 2026-03-31
**Sources:** Official openshift-docs GitHub modules (authoritative), Red Hat docs, OKD docs
**Confidence:** HIGH for node minimums and control plane scaling tables (direct source code). MEDIUM for add-on sizing. LOW for two-node topology details (Tech Preview, limited published specs).

---

## 1. Absolute Minimum Node Requirements (All Topologies)

These are the baseline specs from `modules/installation-minimum-resource-requirements.adoc` in openshift/openshift-docs.

| Node Role | CPU | RAM | Storage | IOPS |
|-----------|-----|-----|---------|------|
| Bootstrap | 4 vCPU | 16 GB | 100 GB | 300 |
| Control Plane (master) | 4 vCPU | 16 GB | 100 GB | 300 |
| Compute (worker) | 2 vCPU | 8 GB | 100 GB | 300 |

**Notes:**
- 1 vCPU = 1 physical core when SMT/HT is disabled. With HT: (threads_per_core × cores) × sockets = vCPUs.
- Storage is measured as the root filesystem `/var/` partition. Separate `/var/lib/etcd` disk strongly recommended for control plane nodes.
- etcd requires **10 ms p99 fsync** latency. This drives the 300 IOPS floor; NVMe is strongly recommended in production.
- x86-64 clusters on OCP 4.19+ require **x86-64-v2 ISA** (Haswell or later).

---

## 2. Topology-Specific Requirements

### 2.1 Standard HA (3 Control Plane + Workers + optional Infra nodes)

This is the production-grade, fully supported topology.

| Node Role | Count | Min CPU | Min RAM | Min Storage |
|-----------|-------|---------|---------|-------------|
| Control plane | 3 | 4 vCPU | 16 GB | 100 GB (SSD) |
| Worker | ≥ 2 | 2 vCPU | 8 GB | 100 GB |
| Infra (optional) | ≥ 3 | 4 vCPU | 16 GB | 100 GB |

**Control plane scaling by cluster size** (from `modules/master-node-sizing.adoc`, cluster-density testing):

| Compute nodes | Cluster-density (namespaces) | Control plane CPU | Control plane RAM |
|---------------|------------------------------|-------------------|-------------------|
| 24 | 500 | 4 cores | 16 GB |
| 120 | 1000 | 8 cores | 32 GB |
| 252 | 4000 | 16 cores (24 with OVN-K) | 64 GB (128 with OVN-K) |
| 501 | 4000 | 16 cores | 96 GB |

**OVN-Kubernetes note:** The OVN-Kubernetes CNI plugin adds significant control plane overhead at scale — plan for the higher column values above 120 nodes.

**OLM memory overhead on control plane** (must add to baseline):

| Namespaces | OLM idle (GB) | OLM with 5 operators (GB) |
|------------|---------------|--------------------------|
| 500 | 0.82 | 1.7 |
| 1000 | 1.2 | 2.5 |
| 2000 | 2.0 | 4.4 |
| 4000 | 3.8 | 7.6 |
| 10000 | 9.9 | 21.6 |

**Safety rule:** Keep overall CPU and memory usage on control plane nodes at or below **60% capacity** to handle one-node-down scenarios and rolling upgrades.

---

### 2.2 Compact 3-Node Cluster

Control plane nodes also serve as compute nodes (schedulable). Workers = 0.

| Node Role | Count | Min CPU | Min RAM | Min Storage |
|-----------|-------|---------|---------|-------------|
| Control plane + compute | 3 | 4 vCPU | 16 GB | 100 GB (SSD) |

**Notes:**
- Set `compute.replicas: 0` in install-config to make control plane nodes schedulable.
- Additional subscriptions required — control plane nodes count as compute nodes.
- etcd on the same node as workloads; NVMe is mandatory for reasonable performance.
- Practical minimum for real workloads: 8 vCPU / 32 GB RAM per node.

---

### 2.3 Single Node OpenShift (SNO) — Standard Profile

One node combines control plane + compute. Fully supported in GA.

| Node Role | Count | Min CPU | Min RAM | Min Storage |
|-----------|-------|---------|---------|-------------|
| Combined master + worker | 1 | 8 vCPU | 16 GB | 120 GB |

**Notes:**
- No HA — single point of failure; suitable for edge and dev/test.
- Local Volume Manager Storage (LVMS) requires a second empty disk.
- If OpenShift Virtualization is enabled: second local storage device ≥ 50 GB required.
- Architecture: x86_64 or aarch64.

---

### 2.4 Single Node OpenShift — Telecom/vDU Profile

Optimized for 5G Radio Access Network Distributed Unit (vDU) workloads at cell sites.

| Parameter | Value |
|-----------|-------|
| Platform | Bare metal |
| CPU | Varies; example: Intel Xeon Gold 6338N (32 cores), NUMA-aware allocation |
| RAM | Typically 64–128 GB (DU workload is RAM-intensive) |
| Storage | NVMe for OS + etcd |
| NICs | 25 GbE or 100 GbE, typically with DPDK acceleration |
| Accelerators | Up to 6× PCIe 4.0 5G DSP accelerators (e.g., Intel ACC100/ACC200, Marvell OCTEON) |
| Kernel | Real-time kernel (kernel-rt) required |

**Key configuration requirements (OCP 4.16 `sno-configure-for-vdu`):**
- CPU partitioning (reserved + isolated CPUs via PerformanceProfile)
- Hugepages configuration
- NUMA-aware CPU pinning
- Disable swap, disable CPU frequency scaling
- Certified hardware: check Red Hat Hardware Compatibility List (HCL)

**Source:** `docs.redhat.com/en/documentation/openshift_container_platform/4.16/html/edge_computing/sno-configure-for-vdu`

---

### 2.5 Two-Node with Arbiter (TNA)

**Status: Technology Preview — not for production use (as of OCP 4.20)**

| Node Role | Count | Min CPU | Min RAM | Min Storage |
|-----------|-------|---------|---------|-------------|
| Control plane | 2 | 4 vCPU | 16 GB | 100 GB |
| Arbiter | 1 | 2 vCPU | 8 GB | 50 GB SSD |

**How it works:**
- 2 full control plane nodes run workloads.
- 1 lightweight arbiter node stores the full etcd data set and maintains quorum to prevent split-brain.
- Arbiter does NOT run workload pods.
- Provides HA with minimal hardware: total 3 physical nodes but only 2 need full workload capacity.

**Sizing formula:** Size the 2 control planes as you would standard HA nodes. Arbiter is purely etcd quorum — the 50 GB SSD / 8 GB RAM is the floor.

---

### 2.6 Two-Node with Fencing (TNF)

**Status: Technology Preview — not for production use (as of OCP 4.20)**

| Node Role | Count | Min CPU | Min RAM | Min Storage |
|-----------|-------|---------|---------|-------------|
| Control plane + compute | 2 | 4 vCPU | 16 GB | 100 GB |
| Hardware fencing device | — | — | — | — |

**How it works:**
- Truly 2-node: no arbiter node at all.
- Fencing via hardware BMC with **Redfish-compatible IPMI** (STONITH — Shoot The Other Node In The Head).
- Pacemaker/DRBD manages quorum; the surviving node fences the failed node via RedFish BMC before assuming sole control.
- Requires identical hardware and Redfish-capable BMCs on both nodes.

**Hardware requirement additions:**
- Dedicated management network for BMC communication.
- Both nodes must have RedFish-compatible BMC (e.g., iDRAC, iLO, BMC meeting Redfish v1.0+).
- Recommended: shared storage or synchronous replication for data redundancy.

---

### 2.7 Hosted Control Planes (HCP)

HCP decouples control plane from data plane. Control plane pods run on a **management cluster**; workers run separately as **hosted clusters**.

#### Management Cluster (hosts the HCP pods)

| Topology | Nodes | Node Size |
|----------|-------|-----------|
| Minimum | 3 worker nodes | 8 vCPU, 32 GB RAM each |
| Standard | 3+ workers | 16 vCPU, 64 GB RAM each |

**Per hosted control plane baseline** (from OKD 4.17 official sizing guidance):

| Metric | Value |
|--------|-------|
| Pods per hosted control plane (HA) | ~78 pods |
| CPU requests (baseline, idle) | 5 vCPU |
| Memory requests (baseline, idle) | 18 GiB |

**Load-based scaling formula:**
```
Additional CPU = (QPS / 1000) × 9 vCPU
Additional RAM = (QPS / 1000) × 2.5 GB

Where QPS = API requests per second to hosted kube-apiserver:
  - Low load: ~100 QPS
  - Medium load: 1000 QPS
  - Heavy load: 2000 QPS
```

**Hosted cluster capacity on management cluster:**
- Estimated max hosted clusters = (total_worker_allocatable_CPU - system_overhead) / 5 vCPU per HCP
- More conservative estimate uses 8 vCPU + memory as limiting factor at medium load

#### Hosted Cluster (worker nodes only — no control plane)

| Parameter | Value |
|-----------|-------|
| Node type | Worker only (no masters needed in the hosted cluster) |
| Min workers | 2 (for workload availability) |
| Node sizing | Same as standard worker: 2 vCPU / 8 GB minimum, but workload-driven in practice |

**Source:** `docs.okd.io/4.17/hosted_control_planes/hcp-prepare/hcp-sizing-guidance.html`

---

### 2.8 MicroShift

Single-node, RHEL-based, minimal footprint for edge IoT/near-edge devices.

| Parameter | Value |
|-----------|-------|
| Platform | RHEL 9 (bare metal or VM, not RHCOS) |
| Min CPU | 2 cores (x86_64, aarch64, or riscv64) |
| Min RAM | 2 GB (RHEL + MicroShift overhead only) |
| Min Storage | 10 GB |
| Practical starter VM | 2 vCPU, 3 GB RAM, 20 GB disk |

**Notes:**
- Workload RAM is **additive**: 2 GB system + workload requirements = total RAM needed.
- Does not support HA — single node only.
- Not a substitute for SNO: lacks many OCP operators and APIs.
- Use case: constrained edge devices, factory floor, IoT gateways.

**Source:** `github.com/openshift/microshift` (getting_started.md)

---

## 3. Worker Node Sizing Formula

### 3.1 Allocatable Resources

The actual CPU and RAM available to workloads is less than the raw node capacity:

```
Allocatable = Node Capacity - kube-reserved - system-reserved - eviction-threshold
```

**CPU reservation formula (OCP 4.16 and earlier):**
```
reserved_cpu = 60m + (additional_cores × 10m) + (HT_threads × 5m) + (NUMA_domains × 2.5m)
Minimum enforced: 500m (0.5 CPU core)
```

**CPU reservation formula (OCP 4.17+):**
```
reserved_cpu = 60m + (additional_cores × 12m)
Minimum enforced: 500m for nodes with ≤ 64 CPUs
```

**Memory reservation formula (all versions):**
```
reserved_mem = 25% of first 4 GiB
             + 20% of next 4 GiB (4–8 GiB range)
             + 10% of next 8 GiB (8–16 GiB range)
             + 6% of remaining RAM above 16 GiB
```

**Practical examples:**

| Node capacity | Allocatable CPU | Allocatable RAM | Notes |
|---------------|-----------------|-----------------|-------|
| 4 vCPU / 8 GB | ~3.5 vCPU | ~6.2 GB | Dev/minimal worker |
| 8 vCPU / 16 GB | ~7.4 vCPU | ~12.4 GB | Small worker |
| 16 vCPU / 32 GB | ~15.5 vCPU | ~28.4 GB | Standard worker |
| 32 vCPU / 64 GB | ~31.4 vCPU | ~60.7 GB | Large worker |

### 3.2 Pod Density

| Parameter | Default | Recommended practice |
|-----------|---------|----------------------|
| `maxPods` (per node) | 250 | Plan for 110–200 pods/node to leave headroom |
| `podsPerCore` | 10 | Effective cap = min(podsPerCore × cores, maxPods) |
| Practical density limit | — | ~200 pods/node (avoid stranding compute at 250) |

**Worker count formula (from workload profile):**
```
workers_needed = ceil(total_pod_cpu_requests / (node_allocatable_cpu × target_utilization))

Where:
  target_utilization = 0.70 (70% — leave 30% headroom for bursting and rolling updates)

Also check RAM:
  workers_needed_ram = ceil(total_pod_memory_requests / (node_allocatable_ram × target_utilization))

workers_needed = max(workers_needed_cpu, workers_needed_ram)

Also check pod count:
  workers_needed_pods = ceil(total_pods / max_pods_per_node)

Final workers = max of all three checks
```

**Minimum worker count for HA:** 2 workers (for pod rescheduling during node failure).

### 3.3 Headroom Recommendations

| Scenario | CPU headroom | RAM headroom |
|----------|-------------|-------------|
| Development cluster | 20% | 20% |
| Production (normal) | 30% | 30% |
| Production (rolling upgrade safety) | 40% | 30% |
| High-availability with N+1 | 50% (one node empty) | 50% |

---

## 4. Infrastructure Node Sizing

Infrastructure nodes run platform services and are NOT counted toward subscription limits. Minimum 3 infra nodes for HA.

**Sizing from `modules/infrastructure-node-sizing.adoc`** (monitoring stack + default ingress-controller moved to infra nodes):

| Worker node count | Cluster namespaces | Infra node CPU | Infra node RAM |
|-------------------|--------------------|----------------|----------------|
| 27 | 500 | 4 cores | 24 GB |
| 120 | 1000 | 8 cores | 48 GB |
| 252 | 4000 | 16 cores | 128 GB |

### 4.1 Services Running on Infra Nodes

| Service | Key resource driver | Notes |
|---------|--------------------|----|
| **OpenShift Monitoring** (Prometheus + Alertmanager + Thanos) | RAM-intensive; scales with node/object count | Prometheus needs 2–8+ GB RAM depending on cluster size and retention |
| **OpenShift Logging** (LokiStack or Elasticsearch) | CPU + RAM + storage | Elasticsearch default: 16 GB RAM per instance |
| **Integrated Container Registry** | Storage I/O + RAM | Needs PVC; typically 100–500 GB for medium registry |
| **Ingress (Router)** | CPU (TLS termination) + network throughput | 1 CPU per ~10K RPS for TLS; scale horizontally |
| **OLM / Operator catalog** | Scales with namespace count | OLM memory: see OLM table in section 2.1 |

### 4.2 Monitoring Stack Sizing (Prometheus)

| Cluster size | Prometheus RAM | Alertmanager RAM | Thanos Querier RAM |
|-------------|---------------|----------------|--------------------|
| Small (< 30 nodes, < 1000 pods) | 2 GB | 256 MB | 512 MB |
| Medium (30–100 nodes, 1000–5000 pods) | 4–8 GB | 512 MB | 1–2 GB |
| Large (100–250 nodes, 5000+ pods) | 8–16 GB | 1 GB | 2–4 GB |

---

## 5. Add-On Sizing

### 5.1 OpenShift Data Foundation (ODF)

ODF requires dedicated storage nodes (or labeled worker nodes). Minimum 3 storage nodes for replication.

**Minimum per storage node** (from official ODF planning documentation, consistent across ODF 4.9–4.16):

| Parameter | Minimum | Notes |
|-----------|---------|-------|
| CPU | 16 CPU units | 1 CPU unit = 1 physical core (non-HT) |
| RAM | 64 GB | For 3-node internal-attached mode |
| Storage | Raw block devices (not OS disk) | Minimum 3 × OSD disks per node for replication |
| Min disk size | 512 GB per OSD recommended | Smaller possible but not recommended |

**Scaling:**
- Each additional OSD added to a node: +2 CPU + 5 GiB RAM requested
- ODF total minimum cluster: 3 nodes × (16 CPU + 64 GB) = 48 CPU + 192 GB RAM
- For compact/3-node clusters: 3 nodes × (16 CPU + 64 GB) collocated with app workloads

**Deployment modes:**

| Mode | Node count | Notes |
|------|-----------|-------|
| Internal (converged) | ≥ 3 nodes with ODF label | OSD on same nodes as workloads |
| External | ≥ 3 dedicated ODF nodes | Separate storage cluster (recommended for prod) |
| Stretched (Metro DR) | 4+ nodes across 2 sites | Requires arbiter node for quorum |

### 5.2 Red Hat Advanced Cluster Management (RHACM) Hub Cluster

RHACM hub sizing depends heavily on: number of managed clusters, number of policies, observability configuration, and whether GitOps (ZTP) is enabled.

**Hub cluster hardware:**

| Managed clusters | Hub workers | Worker CPU | Worker RAM | Notes |
|-----------------|------------|-----------|-----------|-------|
| Up to 100 | 3 | 8 vCPU | 32 GB | Standard topology |
| 100–500 | 3–5 | 16 vCPU | 64 GB | With observability |
| 500–2000 | 5+ | 16 vCPU | 64 GB | Multiple hubs recommended |
| 2000–3500 (SNO ZTP) | 3M+3W compact | 16 vCPU | 64 GB | Red Hat lab validated at 3500 SNOs |

**Key limits:**
- etcd database is the primary sizing constraint. Each managed cluster + its resources add objects to hub APIServer etcd.
- NVMe disks for etcd on hub control plane are mandatory at scale.
- Red Hat recommends dedicated ACM hub cluster (do not co-locate unrelated workloads).
- Observability adds ~2701 mCPU + ~12 GB RAM for the observability stack itself.

**Tooling:** `github.com/stolostron/capacity-planning` (Python notebooks for Observability sizing)

### 5.3 GPU Nodes

GPU nodes are standard worker nodes with one or more GPUs added. The NVIDIA GPU Operator handles driver and runtime installation.

| Component | Requirement |
|-----------|-------------|
| Worker node base | Same as standard worker (2 vCPU / 8 GB minimum) |
| NVIDIA GPU Operator | One GPU type per node (mixed GPU types not supported on single node) |
| MIG support | A30, A100, A100X, A800, H100, H800, HGX B200, HGX GB200 |
| vGPU | Supported (except MIG-backed vGPU with OpenShift Virtualization) |
| GPU Operator OCP version | OCP 4.18+ (GPU Operator 25.3.x, as of early 2026) |

**Sizing considerations:**
- GPU nodes should be sized to fully utilize the GPU — CPU and RAM should not bottleneck the accelerator.
- Typical ratio: 8–16 vCPU and 64–256 GB RAM per GPU node (highly workload-dependent).
- NVLink/NVSwitch topologies (e.g., DGX systems) require bare-metal and specific RHCOS configuration.

---

## 6. Sizing Calculation Reference Card

This section provides the formulas that should drive the sizing engine.

### Control Plane Nodes

```
Always: 3 nodes (or 0 for HCP)

Per-node CPU = lookup(worker_count, cp_sizing_table)
Per-node RAM = lookup(worker_count, cp_sizing_table)

cp_sizing_table:
  workers <= 24   → 4 CPU, 16 GB
  workers <= 120  → 8 CPU, 32 GB
  workers <= 252  → 16 CPU (OVN: 24), 64 GB (OVN: 128 GB)
  workers <= 501  → 16 CPU, 96 GB

Safety factor: provision 40% overhead (target max 60% utilization)
```

### Worker Nodes

```
total_pods = sum of all workload pods
total_cpu_req = sum of all pod CPU requests
total_mem_req = sum of all pod RAM requests

workers_by_cpu = ceil(total_cpu_req / (node_allocatable_cpu × 0.70))
workers_by_ram = ceil(total_mem_req / (node_allocatable_ram × 0.70))
workers_by_pods = ceil(total_pods / 200)   # practical density cap

workers = max(workers_by_cpu, workers_by_ram, workers_by_pods)
workers = max(workers, 2)   # minimum for HA
```

### Infrastructure Nodes

```
Always: 3 nodes (if used)

Per-node CPU = lookup(worker_count, infra_sizing_table)
Per-node RAM = lookup(worker_count, infra_sizing_table)

infra_sizing_table:
  workers <= 27   → 4 CPU, 24 GB
  workers <= 120  → 8 CPU, 48 GB
  workers <= 252  → 16 CPU, 128 GB
```

### Allocatable RAM Calculation

```javascript
function allocatableRam(totalGiB) {
  let reserved = 0;
  reserved += 0.25 * Math.min(totalGiB, 4);
  reserved += 0.20 * Math.min(Math.max(totalGiB - 4, 0), 4);
  reserved += 0.10 * Math.min(Math.max(totalGiB - 8, 0), 8);
  reserved += 0.06 * Math.max(totalGiB - 16, 0);
  return totalGiB - reserved;
}
```

### SNO Sizing

```
Fixed: 1 node
Minimum: 8 vCPU / 16 GB / 120 GB
Practical: size for max expected workload + 30% headroom (no failover node)
```

### ODF Storage

```
storage_nodes = 3   (minimum, for 3× replication)
per_node_cpu = 16 + (osd_count × 2)
per_node_ram_GB = 64 + (osd_count × 5)
osd_capacity = usable_capacity × 3  # 3× replication
```

---

## 7. Key Pitfalls for Sizing Engine

| Pitfall | Impact | Mitigation |
|---------|--------|-----------|
| Ignoring OVN-Kubernetes overhead at scale | Control plane undersized at >100 workers | Use higher column in CP sizing table for OVN-K |
| Using raw capacity instead of allocatable | Workers calculated too few | Apply allocatable formula before dividing |
| No rolling upgrade headroom | Cluster stalls during upgrades | Target max 60% utilization on control plane, 70% on workers |
| etcd on non-NVMe disks | Flapping etcd, control plane instability | Always recommend NVMe or high-IOPS SAN for etcd |
| ODF CPU/RAM forgotten in worker sizing | Workers too small after ODF pods are scheduled | Add ODF overhead to node requirements if converged |
| HCP QPS not estimated | Management cluster undersized | Use 1000 QPS as default medium load per hosted cluster |
| Pod count not checked separately from CPU/RAM | Dense microservices deployments hit 250 pod limit | Always include pod density check in worker formula |
| Infra nodes optional but forgotten | Monitoring/logging runs on workers, wastes compute subscriptions | Recommend infra nodes for all production clusters |

---

## 8. Sources

| Source | URL | Confidence |
|--------|-----|-----------|
| openshift-docs: installation-minimum-resource-requirements.adoc | `github.com/openshift/openshift-docs` (main branch) | HIGH |
| openshift-docs: master-node-sizing.adoc | `github.com/openshift/openshift-docs` (main branch) | HIGH |
| openshift-docs: infrastructure-node-sizing.adoc | `github.com/openshift/openshift-docs` (main branch) | HIGH |
| OKD 4.17 HCP sizing guidance | `docs.okd.io/4.17/hosted_control_planes/hcp-prepare/hcp-sizing-guidance.html` | HIGH |
| ODF infrastructure requirements | `docs.redhat.com/en/documentation/red_hat_openshift_data_foundation/4.16/html/planning_your_deployment/infrastructure-requirements_rhodf` | HIGH |
| SNO vDU profile | `docs.redhat.com/en/documentation/openshift_container_platform/4.16/html/edge_computing/sno-configure-for-vdu` | HIGH |
| MicroShift getting started | `github.com/openshift/microshift` (main) | HIGH |
| TNA topology (Tech Preview) | `docs.okd.io/4.20/installing/installing_two_node_cluster/about-two-node-arbiter-installation.html` | MEDIUM (TP feature) |
| TNF topology (Tech Preview) | `docs.okd.io/4.20/installing/installing_two_node_cluster/installing_tnf/install-tnf.html` | MEDIUM (TP feature) |
| NVIDIA GPU Operator | `docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/platform-support.html` | HIGH |
| RHACM capacity planning | `github.com/stolostron/capacity-planning` | MEDIUM |
| Node resource reservations | `access.redhat.com/solutions/5843241` | HIGH |
