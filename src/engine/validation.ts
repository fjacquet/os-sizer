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

  return warnings
}
