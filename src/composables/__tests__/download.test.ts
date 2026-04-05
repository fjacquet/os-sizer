import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downloadBlob } from '../utils/download'

describe('downloadBlob', () => {
  let mockAnchor: { href: string; download: string; click: ReturnType<typeof vi.fn> }
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockAnchor = { href: '', download: '', click: vi.fn() }
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    mockRevokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  it('creates a Blob with the given content and MIME type', () => {
    downloadBlob('hello', 'test.txt', 'text/plain')
    expect(document.createElement).toHaveBeenCalledWith('a')
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
  })

  it('sets href and download on the anchor element', () => {
    downloadBlob('data', 'report.csv', 'text/csv')
    expect(mockAnchor.href).toBe('blob:mock-url')
    expect(mockAnchor.download).toBe('report.csv')
  })

  it('triggers click and revokes the object URL', () => {
    downloadBlob('data', 'file.json', 'application/json')
    expect(mockAnchor.click).toHaveBeenCalledOnce()
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})
