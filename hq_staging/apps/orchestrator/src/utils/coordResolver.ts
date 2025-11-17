/**
 * Coordinate Resolver
 * 
 * Finds placeholders/anchors in files and returns surgical spans for patching.
 * Supports both single-line anchors and explicit block ranges (BEGIN/END).
 */

export type AnchorMode =
  | 'replace-line'       // replace the single line containing the anchor
  | 'insert-before'      // insert before the anchor line
  | 'insert-after'       // insert after the anchor line
  | 'block-replace'      // replace everything between begin/end markers (inclusive or exclusive)
  | 'block-insert-before'
  | 'block-insert-after'

export type ResolveRequest = {
  text: string
  // Single-line anchor, e.g., ###FINAL_MILE_PROMPT__AGENT_TOOLS###
  anchor?: string

  // Block anchors, e.g., /* <<<BEGIN:ID>>> */ ... /* <<<END:ID>>> */
  beginId?: string
  endId?: string

  // Which behavior you want
  mode: AnchorMode

  // For block modes, whether replacement should include the marker lines
  includeMarkers?: boolean
}

export type ResolveResult = {
  ok: true
  // 1-based line numbers, inclusive range for [start..end]
  start: number
  end: number
  hint: string
} | {
  ok: false
  error: string
}

const SINGLE_LINE_ANCHOR = (name: string) =>
  new RegExp(String.raw`^\s*.*${escapeForRegExp(name)}.*$`)

const BEGIN_MARK = (id: string) =>
  new RegExp(String.raw`^\s*[/#]*\s*(?:<|\/\*)*\s*<<<BEGIN:${escapeForRegExp(id)}>>>\s*(?:\*\/)?\s*$`)

const END_MARK = (id: string) =>
  new RegExp(String.raw`^\s*[/#]*\s*(?:<|\/\*)*\s*<<<END:${escapeForRegExp(id)}>>>\s*(?:\*\/)?\s*$`)

// Helper: escape special regex chars in literal
function escapeForRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function resolveCoords(req: ResolveRequest): ResolveResult {
  const lines = req.text.split(/\r?\n/)
  const N = lines.length
  const err = (e: string) => ({ ok: false as const, error: e })

  if (req.mode.startsWith('block')) {
    if (!req.beginId || !req.endId) return err('beginId and endId required for block modes')

    const bRx = BEGIN_MARK(req.beginId)
    const eRx = END_MARK(req.endId)

    let b = -1, e = -1
    for (let i = 0; i < N; i++) {
      if (b < 0 && bRx.test(lines[i])) b = i + 1 // 1-based
      if (e < 0 && eRx.test(lines[i])) e = i + 1
      if (b > 0 && e > 0) break
    }
    if (b < 0) return err(`BEGIN marker not found: ${req.beginId}`)
    if (e < 0) return err(`END marker not found: ${req.endId}`)
    if (e < b) return err('END occurs before BEGIN')

    const include = !!req.includeMarkers
    const insideStart = include ? b : Math.min(b + 1, e) // if adjacent, clamp
    const insideEnd   = include ? e : Math.max(e - 1, b)

    switch (req.mode) {
      case 'block-replace':
        return { ok: true, start: insideStart, end: insideEnd, hint: 'block-replace' }
      case 'block-insert-before':
        return { ok: true, start: insideStart, end: insideStart - 1, hint: 'block-insert-before' } // empty span
      case 'block-insert-after':
        return { ok: true, start: insideEnd + 1, end: insideEnd, hint: 'block-insert-after' } // empty span
      default:
        return err(`Unsupported block mode: ${req.mode}`)
    }
  }

  // Single anchor modes
  if (!req.anchor) return err('anchor required for single-line modes')
  const rx = SINGLE_LINE_ANCHOR(req.anchor)
  let line = -1
  for (let i = 0; i < N; i++) {
    if (rx.test(lines[i])) { line = i + 1; break }
  }
  if (line < 0) return err(`Anchor not found: ${req.anchor}`)

  switch (req.mode) {
    case 'replace-line':     return { ok: true, start: line, end: line, hint: 'replace-line' }
    case 'insert-before':    return { ok: true, start: line, end: line - 1, hint: 'insert-before' }
    case 'insert-after':     return { ok: true, start: line + 1, end: line, hint: 'insert-after' }
    default:
      return err(`Unsupported mode: ${req.mode}`)
  }
}




