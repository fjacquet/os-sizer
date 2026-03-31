import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import LZString from 'lz-string'
import { generateShareUrl, hydrateFromUrl, InputStateSchema, ClusterConfigSchema } from '../useUrlState'

// ── Mock window for Node environment ─────────────────────────────────────────
// The composable uses window.location.search and window.history.replaceState.
// Since the vitest environment is 'node', we mock window globally.

let mockSearch = ''
const mockReplaceState = vi.fn()

const windowMock = {
  location: {
    get search() {
      return mockSearch
    },
    href: 'http://localhost/',
  },
  history: {
    replaceState: mockReplaceState,
  },
}

// ── Mock inputStore ────────────────────────────────────────────────────────────
const mockClusters = vi.fn()
const mockSetClusters = vi.fn()

vi.mock('@/stores/inputStore', () => ({
  useInputStore: () => ({
    get clusters() {
      return mockClusters()
    },
    set clusters(val: unknown) {
      mockSetClusters(val)
    },
    activeClusterIndex: 0,
  }),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeDefaultCluster() {
  return ClusterConfigSchema.parse({})
}

function setWindowSearch(value: string) {
  mockSearch = value
  ;(global as Record<string, unknown>).window = {
    ...windowMock,
    location: {
      search: value,
      href: `http://localhost/${value}`,
    },
  }
}

function setupWindow() {
  ;(global as Record<string, unknown>).window = {
    ...windowMock,
    location: {
      get search() {
        return mockSearch
      },
      href: 'http://localhost/',
    },
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('InputStateSchema', () => {
  it('round-trips default ClusterConfig', () => {
    const defaultCluster = makeDefaultCluster()
    const state = { clusters: [defaultCluster] }
    const json = JSON.stringify(state)
    const reparsed = InputStateSchema.parse(JSON.parse(json))
    // Should equal the default cluster (no id in schema)
    expect(reparsed.clusters[0]).toEqual(defaultCluster)
  })

  it('parses a cluster with all fields set', () => {
    const input = {
      clusters: [
        {
          name: 'Test Cluster',
          topology: 'compact-3node',
          snoProfile: 'edge',
          hcpHostedClusters: 3,
          hcpQpsPerCluster: 500,
          workload: {
            totalPods: 50,
            podCpuMillicores: 250,
            podMemMiB: 256,
            nodeVcpu: 8,
            nodeRamGB: 16,
          },
          addOns: {
            odfEnabled: true,
            odfExtraOsdCount: 2,
            infraNodesEnabled: true,
            rhacmEnabled: true,
            rhacmManagedClusters: 5,
          },
          environment: 'edge',
          haRequired: false,
          airGapped: true,
          maxNodes: 10,
        },
      ],
    }
    const result = InputStateSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.clusters[0].name).toBe('Test Cluster')
      expect(result.data.clusters[0].topology).toBe('compact-3node')
      expect(result.data.clusters[0].addOns.odfEnabled).toBe(true)
      expect(result.data.clusters[0].maxNodes).toBe(10)
    }
  })
})

describe('hydrateFromUrl', () => {
  beforeEach(() => {
    mockSearch = ''
    vi.clearAllMocks()
    setupWindow()
  })

  afterEach(() => {
    delete (global as Record<string, unknown>).window
  })

  it('no-ops when ?c= is absent', () => {
    // No ?c= param in URL
    hydrateFromUrl()
    expect(mockSetClusters).not.toHaveBeenCalled()
  })

  it('no-ops on malformed LZString (decompression returns null)', () => {
    // Set an invalid compressed value that LZString cannot decompress
    setWindowSearch('?c=INVALID_NOT_LZSTRING_DATA_!!!!')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    hydrateFromUrl()
    expect(mockSetClusters).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('no-ops on invalid JSON inside compressed data', () => {
    // Compress something that is not valid JSON
    const notJson = 'this is not json {'
    const compressed = LZString.compressToEncodedURIComponent(notJson)
    setWindowSearch(`?c=${compressed}`)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    hydrateFromUrl()
    expect(mockSetClusters).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith('[os-sizer] URL state: JSON parse error')
    warnSpy.mockRestore()
  })

  it('no-ops on Zod validation failure (clusters is not an array)', () => {
    // Compress valid JSON but with wrong shape — clusters must be array with min(1)
    const wrongShape = { clusters: 'not-an-array' }
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(wrongShape))
    setWindowSearch(`?c=${compressed}`)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    hydrateFromUrl()
    expect(mockSetClusters).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      '[os-sizer] URL state: schema validation failed',
      expect.any(Array),
    )
    warnSpy.mockRestore()
  })

  it('hydrates store on valid ?c= param', () => {
    const state = { clusters: [makeDefaultCluster()] }
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(state))
    setWindowSearch(`?c=${compressed}`)
    hydrateFromUrl()
    expect(mockSetClusters).toHaveBeenCalledOnce()
    const hydrated = mockSetClusters.mock.calls[0][0]
    expect(Array.isArray(hydrated)).toBe(true)
    expect(hydrated).toHaveLength(1)
    // id should be re-generated (not empty)
    expect(typeof hydrated[0].id).toBe('string')
    expect(hydrated[0].id.length).toBeGreaterThan(0)
    // name should match
    expect(hydrated[0].name).toBe('Cluster 1')
  })
})

describe('generateShareUrl', () => {
  beforeEach(() => {
    mockSearch = ''
    vi.clearAllMocks()
    setupWindow()
  })

  afterEach(() => {
    delete (global as Record<string, unknown>).window
  })

  it('produces a URL with ?c= param', () => {
    const defaultCluster = { ...makeDefaultCluster(), id: 'test-id-123' }
    mockClusters.mockReturnValue([defaultCluster])
    const url = generateShareUrl()
    expect(url).toContain('?c=')
  })

  it('round-trip: encode then decode restores cluster data (sans id)', () => {
    const defaultCluster = { ...makeDefaultCluster(), id: 'some-ephemeral-id' }
    mockClusters.mockReturnValue([defaultCluster])
    const url = generateShareUrl()
    const params = new URLSearchParams(new URL(url).search)
    const compressed = params.get('c')
    expect(compressed).not.toBeNull()
    const json = LZString.decompressFromEncodedURIComponent(compressed!)
    expect(json).not.toBeNull()
    const parsed = InputStateSchema.parse(JSON.parse(json!))
    expect(parsed.clusters).toHaveLength(1)
    // id is excluded from URL state
    expect((parsed.clusters[0] as Record<string, unknown>).id).toBeUndefined()
    // other fields match
    expect(parsed.clusters[0].name).toBe(defaultCluster.name)
    expect(parsed.clusters[0].topology).toBe(defaultCluster.topology)
  })

  it('excludes cluster ids from the encoded URL', () => {
    const cluster = { ...makeDefaultCluster(), id: 'should-not-appear-in-url' }
    mockClusters.mockReturnValue([cluster])
    const url = generateShareUrl()
    // The id should not appear in the URL
    expect(url).not.toContain('should-not-appear-in-url')
  })
})
