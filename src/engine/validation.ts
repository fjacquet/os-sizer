// Input validation for ClusterConfig — zero Vue imports (ENG-09)
// Returns ValidationWarning[] — never throws.
import type { ClusterConfig, ValidationWarning } from './types'
import { WORKER_MIN } from './constants'

/**
 * Validate ClusterConfig inputs and return warnings/errors.
 * All messageKey values are i18n keys (no English strings).
 */
export function validateInputs(config: ClusterConfig): ValidationWarning[] {
  const warnings: ValidationWarning[] = []

  if (config.workload.totalPods < 0) {
    warnings.push({ code: 'NEGATIVE_PODS', severity: 'error', messageKey: 'validation.negativePods' })
  }

  if (config.workload.nodeRamGB < WORKER_MIN.ramGB) {
    warnings.push({ code: 'WORKER_RAM_BELOW_MIN', severity: 'warning', messageKey: 'validation.workerRamBelowMin' })
  }

  if (config.workload.nodeVcpu < WORKER_MIN.vcpu) {
    warnings.push({ code: 'WORKER_CPU_BELOW_MIN', severity: 'warning', messageKey: 'validation.workerCpuBelowMin' })
  }

  if (config.workload.totalPods === 0 && (config.workload.podCpuMillicores > 0 || config.workload.podMemMiB > 0)) {
    warnings.push({ code: 'ZERO_PODS_WITH_RESOURCES', severity: 'warning', messageKey: 'validation.zeroPodsWithResources' })
  }

  if (config.addOns.odfEnabled && ['sno', 'microshift', 'managed-cloud'].includes(config.topology)) {
    warnings.push({ code: 'ODF_INCOMPATIBLE_TOPOLOGY', severity: 'error', messageKey: 'validation.odfIncompatibleTopology' })
  }

  if (config.addOns.rhacmEnabled && config.addOns.rhacmManagedClusters <= 0) {
    warnings.push({ code: 'RHACM_NO_CLUSTERS', severity: 'warning', messageKey: 'validation.rhacmNoClusters' })
  }

  // WARN-04: RWX storage required for live migration
  // Warn when virt is enabled but neither ODF nor any other RWX storage class is available.
  // For SNO topology, suppress this warning and emit SNO_VIRT_NO_LIVE_MIGRATION instead
  // (SNO + ODF is incompatible per existing ODF_INCOMPATIBLE_TOPOLOGY check).
  if (
    config.addOns.virtEnabled &&
    !config.addOns.odfEnabled &&
    !config.addOns.rwxStorageAvailable &&
    config.topology !== 'sno'
  ) {
    warnings.push({
      code: 'VIRT_RWX_STORAGE_REQUIRED',
      severity: 'warning',
      messageKey: 'warnings.virt.rwxStorageRequired',
    })
  }
  // SNO_VIRT_NO_LIVE_MIGRATION fires on virtEnabled+sno regardless of snoVirtMode.
  // Live migration is architecturally impossible on single-node — this is a topology constraint,
  // not a hardware profile constraint.
  if (config.addOns.virtEnabled && config.topology === 'sno') {
    warnings.push({
      code: 'SNO_VIRT_NO_LIVE_MIGRATION',
      severity: 'warning',
      messageKey: 'warnings.sno.virtNoLiveMigration',
    })
  }

  // WARN-01: GPU passthrough permanently blocks live migration on affected nodes.
  // vfio-pci binds the PCI device exclusively to a VM — VMs with PCIDevice passthrough cannot be live-migrated.
  // Source: KubeVirt host devices guide + Harvester live migration docs
  if (config.addOns.gpuEnabled && config.addOns.gpuMode === 'passthrough') {
    warnings.push({
      code: 'GPU_PASSTHROUGH_BLOCKS_LIVE_MIGRATION',
      severity: 'warning',
      messageKey: 'warnings.gpu.passthroughBlocksLiveMigration',
    })
  }

  // WARN-03: MIG-backed vGPU combined with KubeVirt VMs is unsupported by the standard GPU Operator.
  // Source: NVIDIA GPU Operator + OpenShift Virtualization docs (24.9.2): "MIG-backed vGPUs are not supported"
  // Red Hat Customer Portal article 7115541 describes a workaround using a custom DaemonSet.
  if (config.addOns.gpuEnabled && config.addOns.migProfile !== '' && config.addOns.virtEnabled) {
    warnings.push({
      code: 'MIG_PROFILE_WITH_KUBEVIRT_UNSUPPORTED',
      severity: 'warning',
      messageKey: 'warnings.gpu.migProfileWithKubevirtUnsupported',
    })
  }

  return warnings
}
