import { createHash } from 'node:crypto'
import { estimateTokenCount } from './groqTokenBudget.js'

function digest(value) {
  return createHash('sha256').update(value).digest('hex')
}

function textPages(sourceText) {
  const pages = []
  let current = { number: 1, lines: [] }
  for (const line of String(sourceText || '').split(/\r?\n/)) {
    const marker = line.match(/^\s*\[\[PAGE\s+(\d+)\]\]\s*$/i)
    if (marker) {
      if (current.lines.length || pages.length) pages.push(current)
      current = { number: Number(marker[1]), lines: [] }
    } else current.lines.push(line)
  }
  if (current.lines.length || !pages.length) pages.push(current)
  return pages.map((page) => ({ ...page, lines: page.lines.join('\n').trim() })).filter((page) => page.lines)
}

function splitLongLine(line, maxTokens) {
  if (estimateTokenCount(line) <= maxTokens) return [line]
  const sentences = line.match(/[^.!?;]+[.!?;]?/g)?.map((part) => part.trim()).filter(Boolean) || [line]
  const result = []
  let current = ''
  for (const sentence of sentences) {
    if (estimateTokenCount(sentence) > maxTokens) {
      if (current) result.push(current), current = ''
      const words = sentence.split(/(\s+)/).filter(Boolean)
      let wordChunk = ''
      for (const word of words) {
        if (estimateTokenCount(word) > maxTokens) {
          if (wordChunk) result.push(wordChunk.trim()), wordChunk = ''
          let fragment = ''
          for (const character of [...word]) {
            if (fragment && estimateTokenCount(fragment + character) > maxTokens) {
              result.push(fragment)
              fragment = ''
            }
            fragment += character
          }
          if (fragment) result.push(fragment)
          continue
        }
        if (wordChunk && estimateTokenCount(wordChunk + word) > maxTokens) {
          result.push(wordChunk.trim())
          wordChunk = ''
        }
        wordChunk += word
      }
      if (wordChunk.trim()) result.push(wordChunk.trim())
      continue
    }
    const candidate = current ? `${current} ${sentence}` : sentence
    if (current && estimateTokenCount(candidate) > maxTokens) result.push(current), current = sentence
    else current = candidate
  }
  if (current) result.push(current)
  return result
}

function trailingOverlap(text, overlapTokens) {
  if (!text || overlapTokens <= 0) return ''
  const words = text.trim().split(/\s+/)
  let suffix = ''
  for (let index = words.length - 1; index >= 0; index -= 1) {
    const candidate = `${words[index]} ${suffix}`.trim()
    if (estimateTokenCount(candidate) > overlapTokens) break
    suffix = candidate
  }
  return suffix
}

export function splitOversizedChunk(chunk, { overlapTokens = 120 } = {}) {
  const lines = chunk.text.split('\n')
  const tokens = chunk.text.split(/\s+/)
  if (tokens.length < 2) return []
  const target = Math.floor(chunk.text.length / 2)
  const lineBreaks = [...chunk.text.matchAll(/\n/g)].map((match) => match.index)
  const breakAt = lineBreaks.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0]
  let left
  let right
  if (breakAt > 0 && Math.abs(breakAt - target) < chunk.text.length * 0.2) {
    left = chunk.text.slice(0, breakAt).trim()
    const prefix = chunk.text.slice(0, breakAt)
    const activeMarker = [...prefix.matchAll(/^\[\[PAGE\s+\d+\]\]$/gm)].at(-1)?.[0]
    const overlapText = trailingOverlap(left.split(activeMarker || '').at(-1), overlapTokens)
    right = `${activeMarker ? `${activeMarker}\n` : ''}${overlapText ? `${overlapText}\n` : ''}${chunk.text.slice(breakAt + 1).trim()}`
  } else {
    const midpoint = Math.floor(tokens.length / 2)
    const overlap = Math.max(0, Math.min(overlapTokens, Math.floor(tokens.length / 5)))
    left = tokens.slice(0, midpoint).join(' ')
    right = tokens.slice(Math.max(0, midpoint - overlap)).join(' ')
    // Keep each page marker with the content that follows it after word splitting.
    const pageMarker = chunk.text.match(/^\[\[PAGE\s+\d+\]\]/m)?.[0]
    if (pageMarker && !left.includes(pageMarker)) left = `${pageMarker}\n${left}`
    if (pageMarker && !right.includes(pageMarker)) right = `${pageMarker}\n${right}`
  }
  if (!left || !right || left === chunk.text || right === chunk.text) return []
  const build = (text, suffix) => {
    const pageNumbers = [...text.matchAll(/^\[\[PAGE\s+(\d+)\]\]$/gm)].map((match) => Number(match[1]))
    const fullText = text
    return { ...chunk, pageStart: pageNumbers.length ? Math.min(...pageNumbers) : chunk.pageStart, pageEnd: pageNumbers.length ? Math.max(...pageNumbers) : chunk.pageEnd, text: fullText, chunkId: digest(`${chunk.pageStart}:${chunk.pageEnd}:${suffix}:${fullText}`), estimatedInputTokens: estimateTokenCount(fullText), depth: (chunk.depth || 0) + 1 }
  }
  return [build(left, 'left'), build(right, 'right')]
}

export function createMedicalDocumentChunks(sourceText, { maxTokens = 2000, overlapTokens = 120 } = {}) {
  if (!Number.isInteger(maxTokens) || maxTokens < 256) throw new RangeError('maxTokens must be at least 256')
  const chunks = []
  let body = ''
  let lastChunkBody = ''
  let activePage = null
  const pageNumbersFor = (value) => [...value.matchAll(/^\[\[PAGE\s+(\d+)\]\]$/gm)].map((match) => Number(match[1]))
  const flush = () => {
    if (!body) return
    const pageNumbers = pageNumbersFor(body)
    const chunk = { pageStart: pageNumbers.length ? Math.min(...pageNumbers) : activePage || 1, pageEnd: pageNumbers.length ? Math.max(...pageNumbers) : activePage || 1, text: body.trim(), estimatedInputTokens: estimateTokenCount(body), depth: 0 }
    chunk.chunkId = digest(`${chunk.pageStart}:${chunk.pageEnd}:${chunk.text}`)
    chunks.push(chunk)
    lastChunkBody = body.trim()
    body = ''
  }
  for (const page of textPages(sourceText)) {
    activePage = page.number
    const marker = `[[PAGE ${page.number}]]`
    if (body && estimateTokenCount(`${body}\n${marker}`) > maxTokens) flush()
    body = body ? `${body}\n${marker}` : marker
    const segments = page.lines.split(/\n+/).flatMap((line) => splitLongLine(line.trim(), Math.max(128, maxTokens - estimateTokenCount(marker)))).filter(Boolean)
    for (const segment of segments) {
      let candidate = `${body}\n${segment}`
      if (estimateTokenCount(candidate) > maxTokens) {
        flush()
        const pageMarker = `[[PAGE ${page.number}]]`
        const priorPageText = lastChunkBody.split(pageMarker).at(-1) || ''
        const availableOverlap = Math.max(0, maxTokens - estimateTokenCount(pageMarker) - estimateTokenCount(segment))
        const overlap = Math.min(overlapTokens, availableOverlap) > 0 ? trailingOverlap(priorPageText, Math.min(overlapTokens, availableOverlap)) : ''
        body = `${pageMarker}${overlap ? `\n${overlap}` : ''}\n${segment}`
        candidate = body
        if (estimateTokenCount(candidate) > maxTokens) body = `${pageMarker}\n${segment}`
      } else body = candidate
      if (estimateTokenCount(body) > maxTokens) {
        const markerText = `[[PAGE ${page.number}]]`
        const content = body.split(markerText).at(-1).trim()
        const parts = splitLongLine(content, maxTokens - estimateTokenCount(markerText))
        body = ''
        for (const part of parts) {
          if (body && estimateTokenCount(`${body}\n${part}`) > maxTokens) flush()
          if (!body) body = `${markerText}\n${part}`
          else body = `${body}\n${part}`
        }
      }
    }
  }
  flush()
  return chunks.map((chunk, index) => ({ ...chunk, index }))
}

export function mergeDocumentChunkResults(results) {
  const inputs = results.filter(Boolean)
  const firstUnique = (field, evidenceField) => {
    const values = new Set(inputs.map((result) => result[field]).filter(Boolean))
    if (values.size !== 1) return [null, null]
    const value = [...values][0]
    const evidence = inputs.find((result) => result[field] === value)?.[evidenceField] || null
    return [value, evidence]
  }
  const [documentType, documentTypeEvidence] = firstUnique('documentType', 'documentTypeEvidence')
  const [documentTitle, documentTitleEvidence] = firstUnique('documentTitle', 'documentTitleEvidence')
  const [category, categoryEvidence] = firstUnique('category', 'categoryEvidence')
  const [provider, providerEvidence] = firstUnique('provider', 'providerEvidence')
  const dates = new Map()
  for (const item of inputs) if (item.reportDate) dates.set(item.reportDate, item.reportDateEvidence || '')
  const reportDate = dates.size === 1 ? [...dates.keys()][0] : null
  const reportDateEvidence = reportDate ? dates.get(reportDate) || null : null
  const unique = (field, keyFields) => {
    const found = new Map()
    for (const item of inputs.flatMap((result) => Array.isArray(result[field]) ? result[field] : [])) {
      const key = keyFields.map((key) => String(item[key] ?? '').normalize('NFKC').toLowerCase().trim()).join('|')
      if (!found.has(key)) found.set(key, item)
    }
    return [...found.values()]
  }
  const details = unique('details', ['label', 'value'])
  for (const [field, label, evidenceField] of [
    ['documentType', 'Conflicting document type', 'documentTypeEvidence'],
    ['documentTitle', 'Conflicting document title', 'documentTitleEvidence'],
    ['category', 'Conflicting document category', 'categoryEvidence'],
    ['provider', 'Conflicting provider', 'providerEvidence'],
    ['reportDate', 'Conflicting report date', 'reportDateEvidence'],
  ]) {
    const values = new Map()
    for (const item of inputs) if (item[field]) values.set(item[field], item[evidenceField] || null)
    if (values.size > 1) for (const [value, evidence] of values) {
      const key = `${label}|${value}`
      if (!details.some((item) => `${item.label}|${item.value}` === key)) details.push({ label, value, evidence, pageNumber: null })
    }
  }
  return {
    documentType, documentTypeEvidence, documentTitle, documentTitleEvidence, category, categoryEvidence,
    provider, providerEvidence,
    patientInformation: unique('patientInformation', ['label', 'value']),
    reportDate, reportDateEvidence,
    findings: unique('findings', ['text', 'pageNumber']),
    tests: unique('tests', ['name', 'value', 'unit', 'referenceRange', 'abnormalFlag', 'reportDate', 'pageNumber']),
    medications: unique('medications', ['name', 'dosage', 'route', 'frequency', 'duration', 'instructions', 'pageNumber']),
    sections: unique('sections', ['type', 'title', 'text', 'pageNumber']),
    details,
  }
}

export function hierarchicalMergeDocumentChunkResults(results, { fanIn = 16 } = {}) {
  if (!Number.isInteger(fanIn) || fanIn < 2) throw new RangeError('fanIn must be at least 2')
  let level = results.filter(Boolean)
  while (level.length > fanIn) {
    const next = []
    for (let index = 0; index < level.length; index += fanIn) next.push(mergeDocumentChunkResults(level.slice(index, index + fanIn)))
    level = next
  }
  return mergeDocumentChunkResults(level)
}
