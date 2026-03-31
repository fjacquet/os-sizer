// Core sizing formula functions for os-sizer — zero Vue imports (CALC-01)
// All arithmetic uses decimal.js to avoid floating-point drift.
// Source: .planning/research/hardware-sizing.md

import Decimal from 'decimal.js'
import { CP_SIZING_TABLE, INFRA_SIZING_TABLE, TARGET_UTILIZATION, MAX_PODS_PER_NODE } from './constants'

/**
 * Control plane node sizing based on worker count.
 * Performs a sequential lookup against CP_SIZING_TABLE and returns the first
 * tier whose maxWorkers is >= workerCount.
 * Source: hardware-sizing.md section 6 — CP Sizing Table
 */
export function cpSizing(workerCount: number, useOvnK = false): { vcpu: number; ramGB: number } {
  for (const tier of CP_SIZING_TABLE) {
    if (workerCount <= tier.maxWorkers) {
      return useOvnK
        ? { vcpu: tier.vcpuOvnK, ramGB: tier.ramGBOvnK }
        : { vcpu: tier.vcpu, ramGB: tier.ramGB }
    }
  }
  // Above max table entry: use last tier
  const last = CP_SIZING_TABLE[CP_SIZING_TABLE.length - 1]
  return useOvnK
    ? { vcpu: last.vcpuOvnK, ramGB: last.ramGBOvnK }
    : { vcpu: last.vcpu, ramGB: last.ramGB }
}

/**
 * Allocatable RAM after tiered kernel/kubelet reservation.
 * Source: hardware-sizing.md section 3.1 — Memory reservation formula
 *
 * Reservation tiers:
 *   25% of first 4 GiB
 *   20% of next 4 GiB  (4–8 GiB range)
 *   10% of next 8 GiB  (8–16 GiB range)
 *    6% of remainder   (above 16 GiB)
 */
export function allocatableRamGB(totalGB: number): number {
  const reserved = new Decimal(0.25).times(Math.min(totalGB, 4))
    .plus(new Decimal(0.20).times(Math.min(Math.max(totalGB - 4, 0), 4)))
    .plus(new Decimal(0.10).times(Math.min(Math.max(totalGB - 8, 0), 8)))
    .plus(new Decimal(0.06).times(Math.max(totalGB - 16, 0)))
  return new Decimal(totalGB).minus(reserved).toNumber()
}

/**
 * Calculate required worker node count based on workload totals.
 * Returns the maximum of: CPU-limited count, RAM-limited count, pod-density count.
 * Minimum is 2 for HA.
 * Source: hardware-sizing.md section 3.2
 *
 * @param totalPodCpuMillicores - sum of all pod CPU requests in millicores
 * @param totalPodMemMiB        - sum of all pod memory requests in MiB
 * @param totalPods             - total number of pods across all workloads
 * @param nodeVcpu              - worker node vCPU count
 * @param nodeRamGB             - worker node total RAM in GiB
 * @param maxPodsPerNode        - practical pod density cap (default 200)
 * @param targetUtilization     - target utilisation fraction (default 0.70)
 */
export function workerCount(
  totalPodCpuMillicores: number,
  totalPodMemMiB: number,
  totalPods: number,
  nodeVcpu: number,
  nodeRamGB: number,
  maxPodsPerNode: number = MAX_PODS_PER_NODE,
  targetUtilization: number = TARGET_UTILIZATION,
): number {
  const allocRam = allocatableRamGB(nodeRamGB)

  const byCpu = Math.ceil(
    new Decimal(totalPodCpuMillicores)
      .dividedBy(1000)
      .dividedBy(new Decimal(nodeVcpu).times(targetUtilization))
      .toNumber()
  )
  const byRam = Math.ceil(
    new Decimal(totalPodMemMiB)
      .dividedBy(1024)
      .dividedBy(new Decimal(allocRam).times(targetUtilization))
      .toNumber()
  )
  const byPods = Math.ceil(totalPods / maxPodsPerNode)

  return Math.max(byCpu, byRam, byPods, 2)
}

/**
 * Infrastructure node sizing based on worker count.
 * Performs a sequential lookup against INFRA_SIZING_TABLE.
 * Source: hardware-sizing.md section 4
 */
export function infraNodeSizing(workerCount: number): { vcpu: number; ramGB: number } {
  for (const tier of INFRA_SIZING_TABLE) {
    if (workerCount <= tier.maxWorkers) {
      return { vcpu: tier.vcpu, ramGB: tier.ramGB }
    }
  }
  // Above max table entry: use last tier
  const last = INFRA_SIZING_TABLE[INFRA_SIZING_TABLE.length - 1]
  return { vcpu: last.vcpu, ramGB: last.ramGB }
}
