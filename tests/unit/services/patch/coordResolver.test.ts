/**
 * Unit tests for CoordResolver service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CoordResolver, type MarkerLocation } from '../../../../orchestrator/worker/services/patch/coordResolver'
import { readFile } from 'fs/promises'

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn()
}))

// Mock glob
vi.mock('glob', () => ({
  glob: vi.fn().mockResolvedValue([])
}))

describe('CoordResolver', () => {
  let resolver: CoordResolver

  beforeEach(() => {
    resolver = new CoordResolver()
    vi.clearAllMocks()
  })

  describe('findMarkers', () => {
    it('should find markers in TypeScript files', async () => {
      const mockContent = `// Regular comment
// PATCH_MARKER: TEST_MARKER
function test() {
  return true;
}
// PATCH_MARKER: ANOTHER_MARKER
// End of file`

      vi.mocked(readFile).mockResolvedValue(mockContent)

      const markers = await resolver.findMarkers('/test/file.ts')

      expect(markers).toHaveLength(2)
      expect(markers[0]).toEqual({
        filePath: '/test/file.ts',
        lineNumber: 2,
        markerName: 'TEST_MARKER',
        context: '// PATCH_MARKER: TEST_MARKER',
        columnStart: 17,
        columnEnd: 28
      })
      expect(markers[1].markerName).toBe('ANOTHER_MARKER')
    })

    it('should find markers in Python files', async () => {
      const mockContent = `# Regular comment
# PATCH_MARKER: PYTHON_MARKER
def test():
    return True
# End`

      vi.mocked(readFile).mockResolvedValue(mockContent)

      const markers = await resolver.findMarkers('/test/file.py')

      expect(markers).toHaveLength(1)
      expect(markers[0].markerName).toBe('PYTHON_MARKER')
    })

    it('should return empty array for files without markers', async () => {
      const mockContent = `// Regular file without markers
function test() {
  return true;
}`

      vi.mocked(readFile).mockResolvedValue(mockContent)

      const markers = await resolver.findMarkers('/test/file.ts')

      expect(markers).toEqual([])
    })

    it('should handle file read errors', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'))

      await expect(resolver.findMarkers('/nonexistent/file.ts')).rejects.toThrow('Failed to find markers')
    })
  })

  describe('resolveMarkerPosition', () => {
    it('should resolve marker position correctly', async () => {
      const mockContent = `// Line 1
// PATCH_MARKER: TARGET_MARKER
// Line 3`

      vi.mocked(readFile).mockResolvedValue(mockContent)

      const position = await resolver.resolveMarkerPosition('/test/file.ts', 'TARGET_MARKER')

      expect(position).toEqual({
        filePath: '/test/file.ts',
        lineNumber: 2,
        columnStart: 17,
        columnEnd: 30,
        markerName: 'TARGET_MARKER'
      })
    })

    it('should return null for non-existent marker', async () => {
      const mockContent = '// PATCH_MARKER: EXISTING_MARKER'

      vi.mocked(readFile).mockResolvedValue(mockContent)

      const position = await resolver.resolveMarkerPosition('/test/file.ts', 'NON_EXISTENT')

      expect(position).toBeNull()
    })
  })

  describe('findMarkersInFiles', () => {
    it('should find markers across multiple files', async () => {
      const mockGlob = vi.mocked(require('glob').glob)
      mockGlob.mockResolvedValueOnce(['/file1.ts', '/file2.ts'])

      // Mock content for each file
      vi.mocked(readFile)
        .mockResolvedValueOnce('// PATCH_MARKER: MARKER1\nfunction test() {}')
        .mockResolvedValueOnce('// PATCH_MARKER: MARKER2\nfunction test2() {}')

      const markers = await resolver.findMarkersInFiles('**/*.ts')

      expect(markers).toHaveLength(2)
      expect(markers[0].markerName).toBe('MARKER1')
      expect(markers[1].markerName).toBe('MARKER2')
    })

    it('should handle glob errors', async () => {
      const mockGlob = vi.mocked(require('glob').glob)
      mockGlob.mockRejectedValueOnce(new Error('Glob error'))

      await expect(resolver.findMarkersInFiles('**/*.ts')).rejects.toThrow('Failed to find markers in files')
    })
  })

  describe('validateMarkerExists', () => {
    it('should return true for existing markers', async () => {
      const mockContent = '// PATCH_MARKER: EXISTS'

      vi.mocked(readFile).mockResolvedValue(mockContent)

      const exists = await resolver.validateMarkerExists('/test/file.ts', 'EXISTS')

      expect(exists).toBe(true)
    })

    it('should return false for non-existent markers', async () => {
      const mockContent = '// PATCH_MARKER: OTHER'

      vi.mocked(readFile).mockResolvedValue(mockContent)

      const exists = await resolver.validateMarkerExists('/test/file.ts', 'MISSING')

      expect(exists).toBe(false)
    })
  })

  describe('getMarkerContext', () => {
    it('should return context lines around marker', async () => {
      const mockContent = `// Line 1
// Line 2
// PATCH_MARKER: TARGET
// Line 4
// Line 5`

      vi.mocked(readFile).mockResolvedValue(mockContent)

      const context = await resolver.getMarkerContext('/test/file.ts', 'TARGET', 1)

      expect(context).toContain('File: /test/file.ts')
      expect(context).toContain('Marker: TARGET at line 3')
      expect(context.some(line => line.includes('TARGET'))).toBe(true)
    })

    it('should handle marker not found', async () => {
      const mockContent = '// No marker here'

      vi.mocked(readFile).mockResolvedValue(mockContent)

      const context = await resolver.getMarkerContext('/test/file.ts', 'MISSING')

      expect(context[0]).toContain('not found')
    })
  })

  describe('extension support', () => {
    it('should list supported extensions', () => {
      const extensions = resolver.getSupportedExtensions()

      expect(extensions).toContain('.ts')
      expect(extensions).toContain('.py')
      expect(extensions).toContain('.js')
      expect(extensions).toContain('.java')
    })

    it('should check if extension is supported', () => {
      expect(resolver.isExtensionSupported('.ts')).toBe(true)
      expect(resolver.isExtensionSupported('.xyz')).toBe(false)
    })
  })
})
