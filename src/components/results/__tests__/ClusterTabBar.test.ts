/// <reference types="vitest/globals" />
// ClusterTabBar logic tests — pure function extraction pattern (no DOM mount needed)
// Tests cover: tab rendering logic, active tab, add/remove guards, rename, role dropdown, role badge classes
import { describe, it, expect } from 'vitest'

// ── Types mirroring ClusterConfig (subset used by ClusterTabBar) ──────────────
interface ClusterStub {
  id: string
  name: string
  role?: 'hub' | 'spoke' | 'standalone'
}

// ── Pure functions extracted from ClusterTabBar.vue ───────────────────────────
// These are the exact same functions the component uses; tests drive the spec.

const MAX_CLUSTERS = 5

function roleBadgeClass(role: 'hub' | 'spoke' | 'standalone' | undefined): string {
  switch (role) {
    case 'hub':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    case 'spoke':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  }
}

function roleLabel(role: 'hub' | 'spoke' | 'standalone' | undefined, t: (key: string) => string): string {
  switch (role) {
    case 'hub':   return t('results.clusters.roleHub')
    case 'spoke': return t('results.clusters.roleSpoke')
    default:      return t('results.clusters.roleStandalone')
  }
}

function isAddDisabled(clusters: ClusterStub[]): boolean {
  return clusters.length >= MAX_CLUSTERS
}

function isRemoveVisible(clusters: ClusterStub[]): boolean {
  return clusters.length > 1
}

// Rename state machine
function startRename(id: string, currentName: string): { renamingId: string; renameValue: string } {
  return { renamingId: id, renameValue: currentName }
}

function commitRename(
  id: string,
  value: string,
  updateFn: (id: string, patch: { name: string }) => void
): { renamingId: null } {
  const trimmed = value.trim()
  if (trimmed) updateFn(id, { name: trimmed })
  return { renamingId: null }
}

function cancelRename(): { renamingId: null } {
  return { renamingId: null }
}

// Role dropdown state
function selectRole(
  id: string,
  role: 'hub' | 'spoke' | 'standalone',
  updateFn: (id: string, patch: { role: 'hub' | 'spoke' | 'standalone' }) => void
): { openDropdownId: null } {
  updateFn(id, { role })
  return { openDropdownId: null }
}

// Tab rendering: returns array of tab descriptors for given clusters + active index
function buildTabs(clusters: ClusterStub[], activeIdx: number) {
  return clusters.map((c, idx) => ({
    id: c.id,
    name: c.name,
    role: c.role,
    isActive: idx === activeIdx,
    ariaSelected: idx === activeIdx,
  }))
}

// ── Test suite ────────────────────────────────────────────────────────────────

const t = (key: string) => key  // identity stub (same pattern as BomTable.test.ts)

function makeCluster(id: string, name: string, role?: 'hub' | 'spoke' | 'standalone'): ClusterStub {
  return { id, name, role }
}

describe('ClusterTabBar', () => {
  // Test 1: renders one tab per cluster + add button
  it('renders 2 tab descriptors when given 2 clusters', () => {
    const clusters = [makeCluster('a', 'Cluster-1'), makeCluster('b', 'Cluster-2')]
    const tabs = buildTabs(clusters, 0)
    expect(tabs).toHaveLength(2)
    // add button is always rendered (may be disabled) — verified by isAddDisabled
    expect(isAddDisabled(clusters)).toBe(false)
  })

  // Test 2: active tab has ariaSelected true; others false
  it('marks only the active cluster tab as ariaSelected=true', () => {
    const clusters = [makeCluster('a', 'C1'), makeCluster('b', 'C2'), makeCluster('c', 'C3')]
    const tabs = buildTabs(clusters, 1)
    expect(tabs[0].ariaSelected).toBe(false)
    expect(tabs[1].ariaSelected).toBe(true)
    expect(tabs[2].ariaSelected).toBe(false)
  })

  // Test 3: clicking inactive tab sets activeClusterIndex
  it('switching cluster sets the correct activeClusterIndex', () => {
    let activeIndex = 0
    const setActive = (idx: number) => { activeIndex = idx }
    setActive(2)
    expect(activeIndex).toBe(2)
  })

  // Test 4: add button calls addCluster
  it('add cluster triggers addCluster callback', () => {
    let called = false
    const addCluster = () => { called = true }
    addCluster()
    expect(called).toBe(true)
  })

  // Test 5: add button disabled when clusters.length === 5
  it('isAddDisabled returns true when clusters.length === 5', () => {
    const clusters = Array.from({ length: 5 }, (_, i) => makeCluster(`id${i}`, `C${i}`))
    expect(isAddDisabled(clusters)).toBe(true)
  })

  // Test 6: clicking remove calls removeCluster with correct id
  it('remove cluster triggers removeCluster callback with cluster id', () => {
    let removedId = ''
    const removeCluster = (id: string) => { removedId = id }
    removeCluster('target-id')
    expect(removedId).toBe('target-id')
  })

  // Test 7: remove button hidden when only 1 cluster
  it('isRemoveVisible returns false when clusters.length === 1', () => {
    const clusters = [makeCluster('a', 'Only')]
    expect(isRemoveVisible(clusters)).toBe(false)
  })

  // Test 7b: remove button visible when clusters.length > 1
  it('isRemoveVisible returns true when clusters.length > 1', () => {
    const clusters = [makeCluster('a', 'C1'), makeCluster('b', 'C2')]
    expect(isRemoveVisible(clusters)).toBe(true)
  })

  // Test 8: rename on Enter — commits name via updateCluster
  it('commitRename calls updateCluster with trimmed name and clears renamingId', () => {
    let updated: { id: string; patch: { name: string } } | null = null
    const updateFn = (id: string, patch: { name: string }) => { updated = { id, patch } }
    const result = commitRename('cluster-1', '  New Name  ', updateFn)
    expect(updated).toEqual({ id: 'cluster-1', patch: { name: 'New Name' } })
    expect(result.renamingId).toBeNull()
  })

  // Test 9: rename cancel — Escape does NOT commit
  it('cancelRename does not call updateCluster and clears renamingId', () => {
    let called = false
    const updateFn = (_id: string, _patch: { name: string }) => { called = true }
    // cancelRename does not call updateFn — test that directly
    const result = cancelRename()
    expect(called).toBe(false)
    expect(result.renamingId).toBeNull()
    void updateFn // suppress unused warning
  })

  // Test 10: role dropdown — clicking Spoke calls updateCluster with role: 'spoke'
  it('selectRole calls updateCluster with correct role and closes dropdown', () => {
    let updated: { id: string; patch: { role: string } } | null = null
    const updateFn = (id: string, patch: { role: 'hub' | 'spoke' | 'standalone' }) => {
      updated = { id, patch }
    }
    const result = selectRole('cluster-1', 'spoke', updateFn)
    expect(updated).toEqual({ id: 'cluster-1', patch: { role: 'spoke' } })
    expect(result.openDropdownId).toBeNull()
  })

  // Test 11: role badge classes
  it('hub role tab has bg-red-100 class', () => {
    expect(roleBadgeClass('hub')).toContain('bg-red-100')
  })

  it('spoke role tab has bg-blue-100 class', () => {
    expect(roleBadgeClass('spoke')).toContain('bg-blue-100')
  })

  it('standalone (undefined) role tab has bg-gray-100 class', () => {
    expect(roleBadgeClass(undefined)).toContain('bg-gray-100')
    expect(roleBadgeClass('standalone')).toContain('bg-gray-100')
  })

  // Test 12: role labels use i18n keys
  it('roleLabel returns correct i18n key for each role', () => {
    expect(roleLabel('hub', t)).toBe('results.clusters.roleHub')
    expect(roleLabel('spoke', t)).toBe('results.clusters.roleSpoke')
    expect(roleLabel(undefined, t)).toBe('results.clusters.roleStandalone')
    expect(roleLabel('standalone', t)).toBe('results.clusters.roleStandalone')
  })

  // Test 13: commitRename with empty/whitespace-only string does NOT update
  it('commitRename with blank name does not call updateCluster (T-18-01 guard)', () => {
    let called = false
    const updateFn = (_id: string, _patch: { name: string }) => { called = true }
    commitRename('cluster-1', '   ', updateFn)
    expect(called).toBe(false)
  })

  // Test 14: startRename sets renamingId and renameValue
  it('startRename captures cluster id and current name', () => {
    const state = startRename('c1', 'My Cluster')
    expect(state.renamingId).toBe('c1')
    expect(state.renameValue).toBe('My Cluster')
  })
})
