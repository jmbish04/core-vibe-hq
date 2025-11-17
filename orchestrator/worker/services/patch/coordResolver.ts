/**
 * Coordinate Resolver Service
 *
 * Finds placeholder markers in files and resolves them to absolute coordinates
 * for precise patch application.
 */

import { readFile } from 'fs/promises';
import { glob } from 'glob';
import { extname } from 'path';

export interface MarkerLocation {
  filePath: string;
  lineNumber: number;
  markerName?: string;
  context: string;
  columnStart?: number;
  columnEnd?: number;
}

export interface MarkerPosition {
  filePath: string;
  lineNumber: number;
  columnStart: number;
  columnEnd: number;
  markerName: string;
}

/**
 * Comment patterns for different file types
 */
const COMMENT_PATTERNS = {
  '.ts': /(?:\/\/|#)\s*PATCH_MARKER:?\s*(\w+)/,
  '.tsx': /(?:\/\/|#)\s*PATCH_MARKER:?\s*(\w+)/,
  '.js': /(?:\/\/|#)\s*PATCH_MARKER:?\s*(\w+)/,
  '.jsx': /(?:\/\/|#)\s*PATCH_MARKER:?\s*(\w+)/,
  '.py': /#\s*PATCH_MARKER:?\s*(\w+)/,
  '.java': /(?:\/\/|#)\s*PATCH_MARKER:?\s*(\w+)/,
  '.cpp': /(?:\/\/|#)\s*PATCH_MARKER:?\s*(\w+)/,
  '.c': /(?:\/\/|#)\s*PATCH_MARKER:?\s*(\w+)/,
  '.cs': /(?:\/\/|#)\s*PATCH_MARKER:?\s*(\w+)/,
  '.php': /(?:\/\/|#)\s*PATCH_MARKER:?\s*(\w+)/,
  '.rb': /#\s*PATCH_MARKER:?\s*(\w+)/,
  '.go': /(?:\/\/|#)\s*PATCH_MARKER:?\s*(\w+)/,
  '.rs': /(?:\/\/|#)\s*PATCH_MARKER:?\s*(\w+)/,
  '.swift': /(?:\/\/|#)\s*PATCH_MARKER:?\s*(\w+)/,
  '.kt': /(?:\/\/|#)\s*PATCH_MARKER:?\s*(\w+)/,
  '.scala': /(?:\/\/|#)\s*PATCH_MARKER:?\s*(\w+)/,
  '.sql': /--\s*PATCH_MARKER:?\s*(\w+)/,
  '.yaml': /#\s*PATCH_MARKER:?\s*(\w+)/,
  '.yml': /#\s*PATCH_MARKER:?\s*(\w+)/,
  '.json': {},
  '.xml': /<!--\s*PATCH_MARKER:?\s*(\w+)\s*-->/,
  '.html': /<!--\s*PATCH_MARKER:?\s*(\w+)\s*-->/,
  '.md': {},
};

/**
 * CoordResolver finds placeholder markers in files for patching.
 * Supports various file types and comment patterns.
 */
export class CoordResolver {
  /**
   * Finds all placeholder markers in a specific file.
   *
   * @param filePath - Path to the file to search
   * @param markerPattern - Optional custom regex pattern for markers
   * @returns Array of marker locations with line numbers and contexts
   */
  async findMarkers(filePath: string, markerPattern?: RegExp): Promise<MarkerLocation[]> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const markers: MarkerLocation[] = [];

      // Determine file type and get appropriate pattern
      const ext = extname(filePath).toLowerCase();
      const defaultPattern = COMMENT_PATTERNS[ext as keyof typeof COMMENT_PATTERNS];

      if (!defaultPattern && !markerPattern) {
        return markers; // No pattern available for this file type
      }

      const pattern = markerPattern || (defaultPattern as RegExp);

      lines.forEach((line, index) => {
        const match = line.match(pattern);
        if (match) {
          const markerName = match[1] || match[0];
          markers.push({
            filePath,
            lineNumber: index + 1, // 1-based line numbers
            markerName,
            context: line.trim(),
            columnStart: line.indexOf(markerName),
            columnEnd: line.indexOf(markerName) + markerName.length,
          });
        }
      });

      return markers;
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      throw new Error(`Failed to find markers in ${filePath}: ${error}`);
    }
  }

  /**
   * Resolves a relative marker position to absolute file coordinates.
   *
   * @param filePath - Path to the file
   * @param markerName - Name of the marker to find
   * @returns Line number and position information
   */
  async resolveMarkerPosition(filePath: string, markerName: string): Promise<MarkerPosition | null> {
    const markers = await this.findMarkers(filePath);

    for (const marker of markers) {
      if (marker.markerName === markerName) {
        return {
          filePath,
          lineNumber: marker.lineNumber,
          columnStart: marker.columnStart || 0,
          columnEnd: marker.columnEnd || 0,
          markerName,
        };
      }
    }

    return null; // Marker not found
  }

  /**
     * Finds markers across multiple files matching a glob pattern.
     *
     * @param pattern - Glob pattern (e.g., 'src/ *.ts')
     * @param markerPattern - Optional custom regex pattern for markers
     * @returns Array of all marker locations found
     */
  async findMarkersInFiles(pattern: string, markerPattern?: RegExp): Promise<MarkerLocation[]> {
    try {
      const files = await glob(pattern, { nodir: true });
      const allMarkers: MarkerLocation[] = [];

      for (const file of files) {
        try {
          const markers = await this.findMarkers(file, markerPattern);
          allMarkers.push(...markers);
        } catch (error) {
          console.warn(`Skipping file ${file} due to error:`, error);
        }
      }

      return allMarkers;
    } catch (error) {
      console.error(`Error finding markers in files matching ${pattern}:`, error);
      throw new Error(`Failed to find markers in files: ${error}`);
    }
  }

  /**
   * Validates that a marker exists in a file.
   *
   * @param filePath - Path to the file
   * @param markerName - Name of the marker to validate
   * @returns True if marker exists, false otherwise
   */
  async validateMarkerExists(filePath: string, markerName: string): Promise<boolean> {
    const position = await this.resolveMarkerPosition(filePath, markerName);
    return position !== null;
  }

  /**
   * Gets context lines around a marker for better error reporting.
   *
   * @param filePath - Path to the file
   * @param markerName - Name of the marker
   * @param contextLines - Number of context lines to include (default: 3)
   * @returns Array of context lines with line numbers
   */
  async getMarkerContext(filePath: string, markerName: string, contextLines: number = 3): Promise<string[]> {
    try {
      const position = await this.resolveMarkerPosition(filePath, markerName);
      if (!position) {
        return [`Marker '${markerName}' not found in ${filePath}`];
      }

      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      const startLine = Math.max(0, position.lineNumber - contextLines - 1);
      const endLine = Math.min(lines.length, position.lineNumber + contextLines);

      const context: string[] = [
        `File: ${filePath}`,
        `Marker: ${markerName} at line ${position.lineNumber}`,
        '---',
      ];

      for (let i = startLine; i < endLine; i++) {
        const marker = (i + 1 === position.lineNumber) ? ' >>> ' : '     ';
        context.push(`${marker}${i + 1}: ${lines[i]}`);
      }

      return context;
    } catch (error) {
      return [`Error getting context for marker ${markerName}: ${error}`];
    }
  }

  /**
   * Lists all supported file extensions.
   */
  getSupportedExtensions(): string[] {
    return Object.keys(COMMENT_PATTERNS);
  }

  /**
   * Checks if a file extension is supported for marker finding.
   */
  isExtensionSupported(extension: string): boolean {
    return extension.toLowerCase() in COMMENT_PATTERNS;
  }
}
