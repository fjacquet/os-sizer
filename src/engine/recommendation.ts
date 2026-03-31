// Recommendation engine for os-sizer — zero Vue imports (CALC-01)
import type { RecommendationConstraints, TopologyRecommendation, TopologyType } from './types'

/**
 * Recommend topologies based on user constraints.
 * Returns all 8 topologies ranked by fit score (0-100), sorted descending.
 * Topologies with fitScore=0 are excluded from results.
 *
 * Constraint-to-topology mapping derived from Red Hat docs:
 * - far-edge -> SNO, MicroShift preferred
 * - air-gapped -> managed-cloud excluded
 * - ha-required -> SNO, MicroShift excluded
 * - budget <= 3 nodes -> compact-3node preferred
 * - budget <= 1 node -> SNO preferred
 * - cloud -> managed-cloud preferred
 * - large worker count (>20) -> standard-ha, HCP preferred
 */
export function recommend(constraints: RecommendationConstraints): TopologyRecommendation[] {
  const topologies: TopologyType[] = [
    'standard-ha',
    'compact-3node',
    'sno',
    'two-node-arbiter',
    'two-node-fencing',
    'hcp',
    'microshift',
    'managed-cloud',
  ]

  const candidates: TopologyRecommendation[] = []

  for (const topology of topologies) {
    const rec = scoreTopology(topology, constraints)
    if (rec.fitScore > 0) {
      candidates.push(rec)
    }
  }

  // Sort by fitScore descending
  candidates.sort((a, b) => b.fitScore - a.fitScore)
  return candidates
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score))
}

function scoreTopology(
  topology: TopologyType,
  c: RecommendationConstraints,
): TopologyRecommendation {
  switch (topology) {
    case 'standard-ha':
      return scoreStandardHa(c)
    case 'compact-3node':
      return scoreCompact3Node(c)
    case 'sno':
      return scoreSno(c)
    case 'two-node-arbiter':
      return scoreTwoNodeArbiter(c)
    case 'two-node-fencing':
      return scoreTwoNodeFencing(c)
    case 'hcp':
      return scoreHcp(c)
    case 'microshift':
      return scoreMicroshift(c)
    case 'managed-cloud':
      return scoreManagedCloud(c)
  }
}

/**
 * Standard HA — 3 masters + N workers. Best for datacenter HA workloads.
 * base 70 + 20 datacenter + 10 haRequired − 50 if maxNodes < 5
 */
function scoreStandardHa(c: RecommendationConstraints): TopologyRecommendation {
  let score = 70
  if (c.environment === 'datacenter') score += 20
  if (c.haRequired) score += 10
  if (c.maxNodes !== null && c.maxNodes < 5) score -= 50
  return {
    topology: 'standard-ha',
    fitScore: clampScore(score),
    justificationKey: 'recommendation.standardHa.production',
    warningKeys: [],
  }
}

/**
 * Compact 3-node — masters double as workers. Budget-friendly datacenter HA.
 * base 50 + 30 if maxNodes<=3 + 10 datacenter − 30 if estimatedWorkers>20
 */
function scoreCompact3Node(c: RecommendationConstraints): TopologyRecommendation {
  let score = 50
  if (c.maxNodes !== null && c.maxNodes <= 3) score += 30
  if (c.environment === 'datacenter') score += 10
  if (c.estimatedWorkers > 20) score -= 30
  return {
    topology: 'compact-3node',
    fitScore: clampScore(score),
    justificationKey: 'recommendation.compact3Node.budgetFriendly',
    warningKeys: [],
  }
}

/**
 * SNO — Single Node OpenShift. Ideal for edge/far-edge, single-node budget.
 * base 40 + 40 if far-edge or edge + 10 if maxNodes===1
 * Hard exclusion: fitScore=0 if haRequired
 */
function scoreSno(c: RecommendationConstraints): TopologyRecommendation {
  if (c.haRequired) {
    return {
      topology: 'sno',
      fitScore: 0,
      justificationKey: 'recommendation.sno.edgeSingleSite',
      warningKeys: [],
    }
  }
  let score = 40
  if (c.environment === 'far-edge' || c.environment === 'edge') score += 40
  if (c.maxNodes === 1) score += 10
  return {
    topology: 'sno',
    fitScore: clampScore(score),
    justificationKey: 'recommendation.sno.edgeSingleSite',
    warningKeys: [],
  }
}

/**
 * Two-Node Arbiter (TNA) — minimal HA with witness node. Tech preview.
 * base 30 + 20 if maxNodes<=3 + 10 if haRequired
 */
function scoreTwoNodeArbiter(c: RecommendationConstraints): TopologyRecommendation {
  let score = 30
  if (c.maxNodes !== null && c.maxNodes <= 3) score += 20
  if (c.haRequired) score += 10
  return {
    topology: 'two-node-arbiter',
    fitScore: clampScore(score),
    justificationKey: 'recommendation.tna.minimalHa',
    warningKeys: ['validation.techPreviewNotForProduction'],
  }
}

/**
 * Two-Node Fencing (TNF) — bare-metal HA with fencing. Tech preview.
 * base 25 + 20 if maxNodes<=2 + 10 if haRequired
 */
function scoreTwoNodeFencing(c: RecommendationConstraints): TopologyRecommendation {
  let score = 25
  if (c.maxNodes !== null && c.maxNodes <= 2) score += 20
  if (c.haRequired) score += 10
  return {
    topology: 'two-node-fencing',
    fitScore: clampScore(score),
    justificationKey: 'recommendation.tnf.twoNodeFencing',
    warningKeys: ['validation.techPreviewNotForProduction', 'validation.redfishBmcRequired'],
  }
}

/**
 * HCP — Hosted Control Planes. Efficient for large-scale multi-cluster.
 * base 40 + 30 if estimatedWorkers>=20 + 10 if rhacm − 20 if maxNodes<6
 */
function scoreHcp(c: RecommendationConstraints): TopologyRecommendation {
  let score = 40
  if (c.estimatedWorkers >= 20) score += 30
  if (c.addOns.rhacm) score += 10
  if (c.maxNodes !== null && c.maxNodes < 6) score -= 20
  return {
    topology: 'hcp',
    fitScore: clampScore(score),
    justificationKey: 'recommendation.hcp.multiClusterEfficiency',
    warningKeys: [],
  }
}

/**
 * MicroShift — far-edge IoT/device workloads. Minimal footprint.
 * base 30 + 50 if far-edge + 10 if maxNodes===1
 * Hard exclusion: fitScore=0 if haRequired
 */
function scoreMicroshift(c: RecommendationConstraints): TopologyRecommendation {
  if (c.haRequired) {
    return {
      topology: 'microshift',
      fitScore: 0,
      justificationKey: 'recommendation.microshift.constrainedEdge',
      warningKeys: [],
    }
  }
  let score = 30
  if (c.environment === 'far-edge') score += 50
  if (c.maxNodes === 1) score += 10
  return {
    topology: 'microshift',
    fitScore: clampScore(score),
    justificationKey: 'recommendation.microshift.constrainedEdge',
    warningKeys: [],
  }
}

/**
 * Managed Cloud (ROSA/ARO/OSD) — no hardware management.
 * base 60 + 30 if cloud − 40 if not cloud
 * Hard exclusion: fitScore=0 if airGapped
 */
function scoreManagedCloud(c: RecommendationConstraints): TopologyRecommendation {
  if (c.airGapped) {
    return {
      topology: 'managed-cloud',
      fitScore: 0,
      justificationKey: 'recommendation.managedCloud.noHardwareManagement',
      warningKeys: ['validation.managedCloudNoHardware'],
    }
  }
  let score = 60
  if (c.environment === 'cloud') {
    score += 30
  } else {
    score -= 40
  }
  return {
    topology: 'managed-cloud',
    fitScore: clampScore(score),
    justificationKey: 'recommendation.managedCloud.noHardwareManagement',
    warningKeys: ['validation.managedCloudNoHardware'],
  }
}
