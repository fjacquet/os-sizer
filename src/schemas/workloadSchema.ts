import { z } from 'zod'

export const WorkloadSchema = z.object({
  totalPods: z.number().int().min(1, 'validation.minPods'),
  podCpuMillicores: z.number().int().min(1, 'validation.minCpu'),
  podMemMiB: z.number().int().min(1, 'validation.minRam'),
  nodeVcpu: z.number().int().min(2).max(256),
  nodeRamGB: z.number().int().min(8).max(1024),
  odfEnabled: z.boolean(),
  odfExtraOsdCount: z.number().int().min(0).max(20),
  infraNodesEnabled: z.boolean(),
  rhacmEnabled: z.boolean(),
  rhacmManagedClusters: z.number().int().min(0).max(1000),
})

export type WorkloadFormData = z.infer<typeof WorkloadSchema>
