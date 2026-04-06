import { z } from 'zod'

export const EnvironmentSchema = z.object({
  environment: z.enum(['datacenter', 'edge', 'far-edge', 'cloud'] as const),
  haRequired: z.boolean(),
  airGapped: z.boolean(),
  maxNodes: z.number().int().positive().nullable(),
})

export type EnvironmentFormData = z.infer<typeof EnvironmentSchema>
