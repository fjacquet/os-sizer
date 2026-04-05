import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadBlob } from '../utils/download'

// Polyfill DOM APIs in node environment
const mockClick = vi.fn()
const mockAnchor = {
  href: '',
  download: '',
  click: mockClick,
}

const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url')
const mockRevokeObjectURL = vi.fn()

beforeEach(() => {
  mockAnchor.href = ''
  mockAnchor.download = ''
  mockClick.mockClear()
  mockCreateObjectURL.mockClear()
  mockRevokeObjectURL.mockClear()

  // Polyfill globals not available in node environment
  globalThis.Blob = class MockBlob {
    constructor(public parts: unknown[], public options: unknown) {}
  } as unknown as typeof Blob

  globalThis.URL = {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  } as unknown as typeof URL

  globalThis.document = {
    createElement: vi.fn().mockReturnValue(mockAnchor),
  } as unknown as Document
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('downloadBlob', () => {
  it('creates a Blob with the given content and MIME type', () => {
    downloadBlob('hello', 'test.txt', 'text/plain')
    expect(document.createElement).toHaveBeenCalledWith('a')
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Object))
  })

  it('sets href and download on the anchor element', () => {
    downloadBlob('data', 'report.csv', 'text/csv')
    expect(mockAnchor.href).toBe('blob:mock-url')
    expect(mockAnchor.download).toBe('report.csv')
  })

  it('triggers click and revokes the object URL', () => {
    downloadBlob('data', 'file.json', 'application/json')
    expect(mockClick).toHaveBeenCalledOnce()
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})
