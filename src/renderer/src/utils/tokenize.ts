export type TokenKind =
  | 'key' | 'string' | 'number' | 'boolean' | 'null'
  | 'punct'
  | 'tag' | 'attr' | 'attr-value' | 'comment' | 'text'
  | 'line-number'

export const TOKEN_COLORS: Record<TokenKind, string> = {
  key: 'text-purple-500',
  string: 'text-emerald-500',
  number: 'text-amber-500',
  boolean: 'text-cyan-500',
  null: 'text-cyan-500',
  punct: 'text-muted-foreground',
  tag: 'text-blue-500',
  attr: 'text-yellow-600',
  'attr-value': 'text-emerald-500',
  comment: 'text-muted-foreground italic',
  text: '',
  'line-number': 'text-muted-foreground select-none'
}

export interface Token {
  text: string
  kind: TokenKind
}

export function tokenizeJson(line: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < line.length) {
    const c = line[i]

    if (c === ' ' || c === '\t') {
      let start = i
      while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i++
      tokens.push({ text: line.slice(start, i), kind: 'punct' })
      continue
    }

    if (c === '"') {
      let start = i
      i++
      while (i < line.length) {
        if (line[i] === '\\') { i += 2; continue }
        if (line[i] === '"') { i++; break }
        i++
      }
      const str = line.slice(start, i)
      let j = i
      while (j < line.length && (line[j] === ' ' || line[j] === '\t')) j++
      const isKey = j < line.length && line[j] === ':'
      tokens.push({ text: str, kind: isKey ? 'key' : 'string' })
      continue
    }

    if (c === '-' || (c >= '0' && c <= '9')) {
      let start = i
      if (c === '-') i++
      while (i < line.length && line[i] >= '0' && line[i] <= '9') i++
      if (i < line.length && line[i] === '.') { i++; while (i < line.length && line[i] >= '0' && line[i] <= '9') i++ }
      if (i < line.length && (line[i] === 'e' || line[i] === 'E')) {
        i++
        if (i < line.length && (line[i] === '+' || line[i] === '-')) i++
        while (i < line.length && line[i] >= '0' && line[i] <= '9') i++
      }
      tokens.push({ text: line.slice(start, i), kind: 'number' })
      continue
    }

    if (line.startsWith('true', i)) {
      tokens.push({ text: 'true', kind: 'boolean' }); i += 4; continue
    }
    if (line.startsWith('false', i)) {
      tokens.push({ text: 'false', kind: 'boolean' }); i += 5; continue
    }
    if (line.startsWith('null', i)) {
      tokens.push({ text: 'null', kind: 'null' }); i += 4; continue
    }

    tokens.push({ text: c, kind: 'punct' })
    i++
  }

  return tokens
}

function tokenizeTagContent(tag: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  tokens.push({ text: '<', kind: 'punct' })
  i++

  if (i < tag.length && tag[i] === '/') {
    tokens.push({ text: '/', kind: 'punct' })
    i++
  }

  let name = ''
  while (i < tag.length && tag[i] !== ' ' && tag[i] !== '>' && tag[i] !== '/' && tag[i] !== '\t' && tag[i] !== '\n') {
    name += tag[i]
    i++
  }
  if (name) tokens.push({ text: name, kind: 'tag' })

  while (i < tag.length && tag[i] !== '>' && !(tag[i] === '/' && i + 1 < tag.length && tag[i + 1] === '>')) {
    while (i < tag.length && (tag[i] === ' ' || tag[i] === '\t' || tag[i] === '\n')) {
      tokens.push({ text: tag[i], kind: 'punct' })
      i++
    }
    if (i >= tag.length || tag[i] === '>' || (tag[i] === '/' && i + 1 < tag.length && tag[i + 1] === '>')) break

    let attrName = ''
    while (i < tag.length && tag[i] !== '=' && tag[i] !== ' ' && tag[i] !== '\t' && tag[i] !== '\n' && tag[i] !== '>' && tag[i] !== '/') {
      attrName += tag[i]
      i++
    }
    if (attrName) tokens.push({ text: attrName, kind: 'attr' })

    while (i < tag.length && (tag[i] === ' ' || tag[i] === '\t')) {
      tokens.push({ text: tag[i], kind: 'punct' })
      i++
    }

    if (i < tag.length && tag[i] === '=') {
      tokens.push({ text: '=', kind: 'punct' })
      i++
    }

    while (i < tag.length && (tag[i] === ' ' || tag[i] === '\t')) {
      tokens.push({ text: tag[i], kind: 'punct' })
      i++
    }

    if (i < tag.length && (tag[i] === '"' || tag[i] === "'")) {
      const quote = tag[i]
      tokens.push({ text: quote, kind: 'punct' })
      i++
      let val = ''
      while (i < tag.length && tag[i] !== quote) {
        if (tag[i] === '\\') { val += tag[i]; i++; if (i < tag.length) { val += tag[i]; i++ } }
        else { val += tag[i]; i++ }
      }
      if (val) tokens.push({ text: val, kind: 'attr-value' })
      if (i < tag.length) { tokens.push({ text: tag[i], kind: 'punct' }); i++ }
    }
  }

  if (i < tag.length && tag[i] === '/') {
    tokens.push({ text: '/', kind: 'punct' })
    i++
  }
  if (i < tag.length && tag[i] === '>') {
    tokens.push({ text: '>', kind: 'punct' })
  }

  return tokens
}

export function tokenizeXml(line: string): Token[] {
  if (/^\s*$/.test(line)) return [{ text: line, kind: 'text' }]

  const tokens: Token[] = []
  let i = 0

  while (i < line.length) {
    if (line[i] === '<') {
      const end = line.indexOf('>', i)
      if (end !== -1) {
        tokens.push(...tokenizeTagContent(line.slice(i, end + 1)))
        i = end + 1
        continue
      }
    }

    let start = i
    while (i < line.length && line[i] !== '<') i++
    tokens.push({ text: line.slice(start, i), kind: 'text' })
  }

  return tokens
}

export function renderTokens(tokens: Token[], lineNumber?: number): string {
  let html = ''
  if (lineNumber !== undefined) {
    html += `<span class="token-line-number">${lineNumber}</span>`
  }
  for (const t of tokens) {
    const cls = TOKEN_COLORS[t.kind]
    if (cls) {
      html += `<span class="${cls}">${escapeHtml(t.text)}</span>`
    } else {
      html += escapeHtml(t.text)
    }
  }
  return html
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
