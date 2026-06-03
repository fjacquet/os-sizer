// VM disk storage planning — zero Vue imports (CALC-01)
import type { StorageBackend } from '../types'
import { ODF_REPLICA_FACTOR, ODF_FULLNESS_TARGET } from '../constants'

export interface VirtStorage {
  usableGB: number
  rawGB: number // raw provisioned capacity; 0 for external-rwx (provider-managed)
  backend: StorageBackend
}

export function virtStorage(totalDiskGB: number, backend: StorageBackend): VirtStorage {
  if (backend === 'odf') {
    return {
      usableGB: totalDiskGB,
      rawGB: (totalDiskGB * ODF_REPLICA_FACTOR) / ODF_FULLNESS_TARGET,
      backend,
    }
  }
  return { usableGB: totalDiskGB, rawGB: 0, backend }
}
