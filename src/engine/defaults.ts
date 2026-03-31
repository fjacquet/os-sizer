// Defaults factory functions — NOT exported constants (constants = shared refs = mutation bugs)
// Zero Vue imports (CALC-01)
import type { ClusterConfig } from './types'

export function createDefaultClusterConfig(index: number): ClusterConfig {
  return {
    id: crypto.randomUUID(),
    name: `Cluster-${index + 1}`,
    topology: 'standard-ha',
  }
}
