import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportSession, importSession } from '../useSessionExport'

// ── Mock inputStore ────────────────────────────────────────────────────────────
const mockGetClusters = vi.fn()
const mockSetClusters = vi.fn()

vi.mock('@/stores/inputStore', () => ({
  useInputStore: () => ({
    get clusters() {
      return mockGetClusters()
    },
    set clusters(val: unknown) {
      mockSetClusters(val)
    },
  }),
}))

// ── Mock downloadBlob ─────────────────────────────────────────────────────────
const mockDownloadBlob = vi.fn()
vi.mock('@/composables/utils/download', () => ({
  downloadBlob: (...args: unknown[]) => mockDownloadBlob(...args),
}))

// ── Provide real InputStateSchema and ClusterConfigSchema ─────────────────────
vi.mock('@/composables/useUrlState', async () => {
  const actual = await vi.importActual<typeof import('../useUrlState')>('../useUrlState')
  return actual
})

// ── MockFileReader ─────────────────────────────────────────────────────────────
class MockFileReader {
  onload: ((event: { target: { result: string } }) => void) | null = null
  onerror: (() => void) | null = null
  private _content = ''

  readAsText(_file: File) {
    // Trigger either onload or onerror based on content set by test
    setTimeout(() => {
      if (this._content === '__ERROR__') {
        if (this.onerror) this.onerror()
      } else {
        if (this.onload) this.onload({ target: { result: this._content } })
      }
    }, 0)
  }

  // Test helper: set the file content before calling readAsText
  static _nextContent = ''

  static setNextContent(content: string) {
    MockFileReader._nextContent = content
  }

  constructor() {
    this._content = MockFileReader._nextContent
  }
}

// ── Polyfill crypto ────────────────────────────────────────────────────────────
let uuidCounter = 0

// ── Setup/teardown ─────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
  uuidCounter = 0
  MockFileReader._nextContent = ''

  // Use vi.stubGlobal to avoid "read-only property" errors in Node environment
  vi.stubGlobal('FileReader', MockFileReader)
  vi.stubGlobal('crypto', {
    randomUUID: () => `test-uuid-${uuidCounter++}`,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// ── Helpers ────────────────────────────────────────────────────────────────────
function makeValidSessionFile(clusters?: unknown[]): File {
  const state = {
    clusters: clusters ?? [
      {
        name: 'Test Cluster',
        topology: 'standard-ha',
        snoProfile: 'standard',
        hcpHostedClusters: 1,
        hcpQpsPerCluster: 1000,
        workload: {
          totalPods: 10,
          podCpuMillicores: 500,
          podMemMiB: 512,
          nodeVcpu: 16,
          nodeRamGB: 32,
        },
        addOns: {
          odfEnabled: false,
          odfExtraOsdCount: 0,
          infraNodesEnabled: false,
          rhacmEnabled: false,
          rhacmManagedClusters: 0,
          virtEnabled: false,
          vmCount: 50,
          vmsPerWorker: 10,
          virtAvgVmVcpu: 4,
          virtAvgVmRamGB: 8,
          snoVirtMode: false,
          gpuEnabled: false,
          gpuNodeCount: 1,
          gpuMode: 'container',
          gpuModel: 'A100-40GB',
          migProfile: '',
          gpuPerNode: 1,
          rhoaiEnabled: false,
          rwxStorageAvailable: false,
        },
        environment: 'datacenter',
        haRequired: true,
        airGapped: false,
        maxNodes: null,
        role: 'standalone',
      },
    ],
  }
  const json = JSON.stringify(state)
  MockFileReader.setNextContent(json)
  return new File([json], 'session.json', { type: 'application/json' })
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('exportSession', () => {
  it('Test 1 (exportSession): calls downloadBlob with correct JSON, filename, and mimeType', () => {
    const cluster = {
      id: 'some-uuid',
      name: 'Cluster 1',
      topology: 'standard-ha',
      snoProfile: 'standard',
      hcpHostedClusters: 1,
      hcpQpsPerCluster: 1000,
      workload: {
        totalPods: 10,
        podCpuMillicores: 500,
        podMemMiB: 512,
        nodeVcpu: 16,
        nodeRamGB: 32,
      },
      addOns: {
        odfEnabled: false,
        odfExtraOsdCount: 0,
        infraNodesEnabled: false,
        rhacmEnabled: false,
        rhacmManagedClusters: 0,
        virtEnabled: false,
        vmCount: 50,
        vmsPerWorker: 10,
        virtAvgVmVcpu: 4,
        virtAvgVmRamGB: 8,
        snoVirtMode: false,
        gpuEnabled: false,
        gpuNodeCount: 1,
        gpuMode: 'container',
        gpuModel: 'A100-40GB',
        migProfile: '',
        gpuPerNode: 1,
        rhoaiEnabled: false,
        rwxStorageAvailable: false,
      },
      environment: 'datacenter',
      haRequired: true,
      airGapped: false,
      maxNodes: null,
      role: 'standalone',
    }
    mockGetClusters.mockReturnValue([cluster])

    exportSession()

    expect(mockDownloadBlob).toHaveBeenCalledOnce()
    const [json, filename, mimeType] = mockDownloadBlob.mock.calls[0]
    expect(mimeType).toBe('application/json')
    const today = new Date().toISOString().split('T')[0]
    expect(filename).toBe(`os-sizer-session-${today}.json`)
    // JSON must be human-readable (pretty-printed)
    expect(json).toContain('\n')
    // Verify round-trip parses correctly
    const parsed = JSON.parse(json)
    expect(parsed.clusters).toHaveLength(1)
    expect(parsed.clusters[0].name).toBe('Cluster 1')
  })

  it('Test 6 (exportSession excludes id): JSON passed to downloadBlob contains no "id" key in cluster objects', () => {
    const cluster = {
      id: 'should-not-appear-in-export',
      name: 'Cluster 1',
      topology: 'standard-ha',
      snoProfile: 'standard',
      hcpHostedClusters: 1,
      hcpQpsPerCluster: 1000,
      workload: { totalPods: 10, podCpuMillicores: 500, podMemMiB: 512, nodeVcpu: 16, nodeRamGB: 32 },
      addOns: {
        odfEnabled: false, odfExtraOsdCount: 0, infraNodesEnabled: false,
        rhacmEnabled: false, rhacmManagedClusters: 0,
        virtEnabled: false, vmCount: 50, vmsPerWorker: 10,
        virtAvgVmVcpu: 4, virtAvgVmRamGB: 8, snoVirtMode: false,
        gpuEnabled: false, gpuNodeCount: 1, gpuMode: 'container', gpuModel: 'A100-40GB',
        migProfile: '', gpuPerNode: 1, rhoaiEnabled: false, rwxStorageAvailable: false,
      },
      environment: 'datacenter',
      haRequired: true,
      airGapped: false,
      maxNodes: null,
      role: 'standalone',
    }
    mockGetClusters.mockReturnValue([cluster])

    exportSession()

    const [json] = mockDownloadBlob.mock.calls[0]
    const parsed = JSON.parse(json)
    expect((parsed.clusters[0] as Record<string, unknown>).id).toBeUndefined()
    expect(json).not.toContain('should-not-appear-in-export')
  })
})

describe('importSession', () => {
  it('Test 2 (importSession happy path): parses JSON, validates schema, assigns store.clusters with new UUIDs', async () => {
    const file = makeValidSessionFile()

    await importSession(file)

    expect(mockSetClusters).toHaveBeenCalledOnce()
    const clusters = mockSetClusters.mock.calls[0][0]
    expect(Array.isArray(clusters)).toBe(true)
    expect(clusters).toHaveLength(1)
    expect(clusters[0].id).toBe('test-uuid-0')
    expect(clusters[0].name).toBe('Test Cluster')
  })

  it('Test 3 (importSession JSON parse error): rejects with Error("parse") on invalid JSON', async () => {
    MockFileReader.setNextContent('{ this is not valid json !!!}')
    const file = new File(['bad'], 'bad.json', { type: 'application/json' })

    await expect(importSession(file)).rejects.toThrow('parse')
    expect(mockSetClusters).not.toHaveBeenCalled()
  })

  it('Test 4 (importSession schema error): rejects with Error("schema") on valid JSON but wrong schema', async () => {
    const wrongSchema = { clusters: 'not-an-array' }
    MockFileReader.setNextContent(JSON.stringify(wrongSchema))
    const file = new File([JSON.stringify(wrongSchema)], 'wrong.json', { type: 'application/json' })

    await expect(importSession(file)).rejects.toThrow('schema')
    expect(mockSetClusters).not.toHaveBeenCalled()
  })

  it('Test 5 (importSession FileReader error): rejects with Error("read") when FileReader.onerror fires', async () => {
    MockFileReader.setNextContent('__ERROR__')
    const file = new File([''], 'error.json', { type: 'application/json' })

    await expect(importSession(file)).rejects.toThrow('read')
    expect(mockSetClusters).not.toHaveBeenCalled()
  })
})
