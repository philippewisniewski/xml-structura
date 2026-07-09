const CHUNK_SIZE = 0x100000
const AVG_CHARS_PER_LINE = 80
const LINE_HEIGHT = 20
const OVERSCAN = 25

export function highlightXmlLine(line: string): string {
  let h = line
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  h = h.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="text-gray-600 italic">$1</span>')
  h = h.replace(/(&lt;\/?)([\w:-]+)/g, '$1<span class="text-emerald-300">$2</span>')
  h = h.replace(/( [\w:-]+)(=)(&quot;.*?&quot;)/g, '<span class="text-purple-400">$1</span>$2<span class="text-amber-300">$3</span>')
  return h
}

export async function renderVirtualXml(container: HTMLElement, file: File): Promise<void> {
  const totalSize = file.size
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE)

  if (totalChunks <= 1) {
    const text = await readSlice(file, 0, totalSize)
    const lines = text.split('\n')
    if (text.endsWith('\n') && lines.length > 0) lines.pop()
    const html = lines.map((l, i) =>
      `<div style="display:flex"><span class="text-gray-600 select-none mr-4 text-right min-w-[4ch]">${i + 1}</span><span>${highlightXmlLine(l)}</span></div>`
    ).join('')
    container.innerHTML = `<pre class="p-3 overflow-auto h-full text-xs leading-relaxed" style="margin:0"><code>${html}</code></pre>`
    return
  }

  const chunkLines = new Map<number, string[]>()
  const knownCounts = new Map<number, number>()
  const cumCache: number[] = []

  function cnt(ci: number): number {
    const k = knownCounts.get(ci)
    if (k !== undefined) return k
    const sz = Math.min(CHUNK_SIZE, totalSize - ci * CHUNK_SIZE)
    return Math.max(1, Math.ceil(sz / AVG_CHARS_PER_LINE))
  }

  function cum(ci: number): number {
    while (cumCache.length <= ci) {
      const i = cumCache.length
      cumCache.push(i === 0 ? 0 : cumCache[i - 1] + cnt(i - 1))
    }
    return cumCache[ci]
  }

  function totalLines(): number {
    let t = 0
    for (let i = 0; i < totalChunks; i++) t += cnt(i)
    return t
  }

  function findLine(lineIdx: number): { ci: number; li: number } {
    if (lineIdx <= 0) return { ci: 0, li: 0 }
    let acc = 0
    for (let i = 0; i < totalChunks; i++) {
      const c = cnt(i)
      if (acc + c > lineIdx) return { ci: i, li: lineIdx - acc }
      acc += c
    }
    const last = totalChunks - 1
    return { ci: last, li: Math.max(0, cnt(last) - 1) }
  }

  async function loadChunk(ci: number): Promise<string[]> {
    if (ci < 0 || ci >= totalChunks) throw new Error(`bad chunk ${ci}`)
    const cached = chunkLines.get(ci)
    if (cached) return cached

    const start = ci * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, totalSize)
    const text = await readSlice(file, start, end)
    const lines = text.split('\n')
    if (end === totalSize && text.endsWith('\n') && lines.length > 0) lines.pop()

    chunkLines.set(ci, lines)
    knownCounts.set(ci, lines.length)
    if (cumCache.length > ci) cumCache.length = ci

    if (chunkLines.size > 25) {
      const keys = [...chunkLines.keys()].sort((a, b) => a - b)
      for (const k of keys.slice(0, keys.length - 25)) chunkLines.delete(k)
    }

    return lines
  }

  container.innerHTML = ''
  container.style.cssText = 'position:relative;overflow:hidden;height:100%'

  const scroller = document.createElement('div')
  scroller.style.cssText = 'height:100%;overflow:auto;position:relative'

  const spacer = document.createElement('div')
  spacer.style.cssText = `height:${totalLines() * LINE_HEIGHT}px;pointer-events:none`

  const pre = document.createElement('pre')
  pre.style.cssText = 'position:absolute;top:0;left:0;right:0;margin:0;pointer-events:none'
  pre.className = 'p-3 text-xs leading-relaxed'

  const code = document.createElement('code')
  pre.appendChild(code)
  scroller.appendChild(spacer)
  scroller.appendChild(pre)
  container.appendChild(scroller)

  async function render(scrollTop: number): Promise<void> {
    const ch = Math.max(scroller.clientHeight, 100)
    const firstLine = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN)
    const visibleCount = Math.ceil(ch / LINE_HEIGHT) + 2 * OVERSCAN
    const lastLine = firstLine + visibleCount

    let startCi = 0
    let startLi = 0
    {
      const est = findLine(firstLine)
      const raw = await loadChunk(est.ci)
      const actualCum = cum(est.ci)
      if (firstLine >= actualCum && firstLine < actualCum + raw.length) {
        startCi = est.ci
        startLi = firstLine - actualCum
      } else if (firstLine < actualCum) {
        let ci = est.ci - 1
        while (ci >= 0) {
          const c = await loadChunk(ci)
          const cb = cum(ci)
          if (firstLine >= cb && firstLine < cb + c.length) {
            startCi = ci
            startLi = firstLine - cb
            break
          }
          ci--
        }
      } else {
        let ci = est.ci + 1
        while (ci < totalChunks) {
          const c = await loadChunk(ci)
          const cb = cum(ci)
          if (firstLine >= cb && firstLine < cb + c.length) {
            startCi = ci
            startLi = firstLine - cb
            break
          }
          ci++
        }
      }
    }

    const frag = document.createDocumentFragment()
    let lineNum = firstLine
    let ci = startCi
    let li = startLi

    outer:
    while (ci < totalChunks && lineNum <= lastLine) {
      const lines = await loadChunk(ci)
      while (li < lines.length && lineNum <= lastLine) {
        const hl = highlightXmlLine(lines[li])
        const div = document.createElement('div')
        div.style.display = 'flex'
        div.innerHTML = `<span class="text-gray-600 select-none mr-4 text-right min-w-[4ch]">${lineNum + 1}</span><span>${hl}</span>`
        frag.appendChild(div)
        lineNum++
        li++
      }
      li = 0
      ci++
    }

    code.textContent = ''
    code.appendChild(frag)
    pre.style.top = `${firstLine * LINE_HEIGHT}px`
  }

  let tick = 0
  scroller.addEventListener('scroll', () => {
    tick++
    const t = tick
    requestAnimationFrame(() => { if (t === tick) render(scroller.scrollTop).catch(() => {}) })
  })

  requestAnimationFrame(() => render(0).catch(() => {}))
}

function readSlice(file: File, start: number, end: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('File read error'))
    reader.readAsText(file.slice(start, end))
  })
}
