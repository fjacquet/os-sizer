import { describe, it, expect } from 'vitest'
// import { recommend } from './recommendation'

describe('recommend', () => {
  it.todo('datacenter + HA required -> standard-ha ranked first')
  it.todo('far-edge -> includes SNO or MicroShift')
  it.todo('air-gapped -> excludes managed-cloud')
  it.todo('budget-constrained (maxNodes<=3) -> compact-3node ranked high')
  it.todo('every recommendation has justificationKey without spaces')
  it.todo('returns array sorted by fitScore descending')
})
