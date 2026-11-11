/**
 * A small Markdown reader for the documentation pages.
 *
 * The website's /docs page is built from the repository's own Markdown files (README.md and docs/*.md), so the
 * two can never say different things. This reader only knows what those files use: headings, paragraphs, lists,
 * tables, quotes, fenced code, raw HTML blocks, and inline code, bold, italics, links and images. It is pure (no
 * DOM), so it is tested directly.
 */

export type Inline =
  | { t: 'text'; text: string }
  | { t: 'code'; text: string }
  | { t: 'strong'; children: Inline[] }
  | { t: 'em'; children: Inline[] }
  | { t: 'link'; href: string; children: Inline[] }
  | { t: 'img'; src: string; alt: string }

export type Block =
  | { t: 'heading'; level: number; id: string; text: string }
  | { t: 'paragraph'; text: string }
  | { t: 'list'; ordered: boolean; items: string[] }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'quote'; text: string }
  | { t: 'code'; lang: string; live: boolean; code: string }
  | { t: 'html'; html: string }
  | { t: 'rule' }

/** GitHub-style heading anchor: `Light and dark` -> `light-and-dark`. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-')
}

/** Splits a table row `| a | b |` into its cells. */
function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

/** Reads a Markdown document into blocks. */
export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const out: Block[] = []
  let i = 0
  const isBlockStart = (l: string) => /^(#{1,6}\s|```|>|\s*[-*]\s|\s*\d+\.\s|\||<|---\s*$)/.test(l)
  while (i < lines.length) {
    const line = lines[i]!
    if (!line.trim()) {
      i++
      continue
    }
    const fence = line.match(/^```(\S*)\s*(live)?\s*$/)
    if (fence) {
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i]!.startsWith('```')) code.push(lines[i++]!)
      i++
      out.push({ t: 'code', lang: fence[1] ?? '', live: !!fence[2], code: code.join('\n') })
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      const text = heading[2]!.trim()
      out.push({ t: 'heading', level: heading[1]!.length, id: slug(text), text })
      i++
      continue
    }
    if (/^---\s*$/.test(line)) {
      out.push({ t: 'rule' })
      i++
      continue
    }
    if (line.startsWith('>')) {
      const text: string[] = []
      while (i < lines.length && lines[i]!.startsWith('>')) text.push(lines[i++]!.replace(/^>\s?/, ''))
      out.push({ t: 'quote', text: text.join(' ') })
      continue
    }
    if (line.startsWith('|')) {
      const head = cells(line)
      i += 2 // header and separator
      const rows: string[][] = []
      while (i < lines.length && lines[i]!.startsWith('|')) rows.push(cells(lines[i++]!))
      out.push({ t: 'table', head, rows })
      continue
    }
    const item = line.match(/^\s*([-*]|\d+\.)\s+(.*)$/)
    if (item) {
      const ordered = /\d/.test(item[1]!)
      const items: string[] = []
      while (i < lines.length) {
        const m = lines[i]!.match(/^\s*([-*]|\d+\.)\s+(.*)$/)
        if (m) items.push(m[2]!)
        else if (lines[i]!.trim() && /^\s+/.test(lines[i]!)) items[items.length - 1] += ' ' + lines[i]!.trim()
        else break
        i++
      }
      out.push({ t: 'list', ordered, items })
      continue
    }
    if (line.startsWith('<')) {
      const html: string[] = []
      while (i < lines.length && lines[i]!.trim()) html.push(lines[i++]!)
      out.push({ t: 'html', html: html.join('\n') })
      continue
    }
    const text: string[] = [line.trim()]
    i++
    while (i < lines.length && lines[i]!.trim() && !isBlockStart(lines[i]!)) text.push(lines[i++]!.trim())
    out.push({ t: 'paragraph', text: text.join(' ') })
  }
  return out
}

/** Reads the inline part of a line: code, images, links, bold and italics. */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = []
  const re = /`([^`]+)`|!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|(?<![\w*])\*([^*\s][^*]*?)\*(?![\w*])/g
  let last = 0
  for (const m of src.matchAll(re)) {
    if (m.index! > last) out.push({ t: 'text', text: src.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ t: 'code', text: m[1] })
    else if (m[3] !== undefined) out.push({ t: 'img', alt: m[2]!, src: m[3] })
    else if (m[5] !== undefined) out.push({ t: 'link', href: m[5], children: parseInline(m[4]!) })
    else if (m[6] !== undefined) out.push({ t: 'strong', children: parseInline(m[6]) })
    else if (m[7] !== undefined) out.push({ t: 'em', children: parseInline(m[7]) })
    last = m.index! + m[0].length
  }
  if (last < src.length) out.push({ t: 'text', text: src.slice(last) })
  return out
}

/** The pages listed by `docs/README.md`, in order: `[Title](file.md)` gives `{ file, title }`. */
export function pagesOf(index: string): { file: string; title: string }[] {
  return [...index.matchAll(/^\s*-\s+\[([^\]]+)\]\(([\w-]+\.md)\)/gm)].map((m) => ({ title: m[1]!, file: m[2]! }))
}

/** The page id of a Markdown file: `getting-started.md` -> `getting-started`, the root README -> `overview`. */
export const pageIdOf = (file: string) => (/(^|\/)README\.md$/.test(file) && !file.includes('docs/') ? 'overview' : file.replace(/^.*\//, '').replace(/\.md$/, ''))

export const REPO = 'https://github.com/robinnat/mochiz'

/**
 * Where a link of a documentation file points on the website. Links to other doc pages stay on the site
 * (`reference.md#moods` -> `/docs?page=reference#moods`); other repository files go to GitHub.
 * `from` is the folder of the file that holds the link (`''` for the root README, `'docs/'` for the pages).
 */
export function siteHref(href: string, from: '' | 'docs/'): string {
  if (/^(https?:|mailto:|#)/.test(href)) return href
  const [path, hash] = href.split('#') as [string, string | undefined]
  const full = (from + path).replace(/^docs\/\.\.\//, '')
  const doc = full.match(/^docs\/([\w-]+)\.md$/)
  if (doc) return `/docs?page=${doc[1]}${hash ? '#' + hash : ''}`
  if (full === 'README.md') return `/docs?page=overview${hash ? '#' + hash : ''}`
  return `${REPO}/blob/main/${full}${hash ? '#' + hash : ''}`
}
