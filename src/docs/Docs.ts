/// <reference types="vite/client" />
import { ref } from '@/ui/dom/reactive'
import { c, h, onMount, onUnmount, type Component, type Child } from '@/ui/dom/h'
import { Nav } from '@/site/Nav'
import { Footer } from '@/site/Footer'
import { CodeBlock } from '@/site/CodeBlock'
import { Preview } from './preview'
import { initTheme } from '@/site/theme'
import { pageIdOf, pagesOf, parseInline, parseMarkdown, siteHref, slug, type Block, type Inline } from './markdown'

/**
 * The /docs page. It has NO text of its own: every page is a Markdown file of the repository (README.md and
 * docs/*.md), read at build time, and the menu is the list of `docs/README.md`. The website and the repository show
 * the same documentation; `docs-source.test.ts` fails if they could drift apart.
 */

const FILES = import.meta.glob(['/README.md', '/docs/*.md'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const IMAGES = import.meta.glob('/docs/**/*.{png,gif,svg,jpg}', { query: '?url', import: 'default', eager: true }) as Record<string, string>

export interface DocPage {
  id: string
  title: string
  /** path in the repository (`docs/reference.md`) */
  file: string
  /** folder used to resolve the page's relative links */
  from: '' | 'docs/'
  source: string
}

/** The pages, in the order of `docs/README.md`, with the root README as "Overview" first. */
export const PAGES: DocPage[] = [
  { id: 'overview', title: 'Overview', file: 'README.md', from: '', source: FILES['/README.md'] ?? '' },
  ...pagesOf(FILES['/docs/README.md'] ?? '').map((p) => ({
    id: pageIdOf(p.file),
    title: p.title,
    file: 'docs/' + p.file,
    from: 'docs/' as const,
    source: FILES['/docs/' + p.file] ?? ''
  }))
]

/** Groups of the menu: the headings of `docs/README.md` and the pages under each. */
const GROUPS: { title: string; ids: string[] }[] = (() => {
  const groups: { title: string; ids: string[] }[] = [{ title: 'Start here', ids: ['overview'] }]
  for (const line of (FILES['/docs/README.md'] ?? '').split('\n')) {
    const g = line.match(/^##\s+(.*)$/)
    if (g) groups.push({ title: g[1]!, ids: [] })
    const p = line.match(/^\s*-\s+\[[^\]]+\]\(([\w-]+\.md)\)/)
    if (p && groups.length) groups[groups.length - 1]!.ids.push(pageIdOf(p[1]!))
  }
  return groups.filter((g) => g.ids.length)
})()

const LANG_TITLE: Record<string, string> = {
  html: 'HTML',
  js: 'JavaScript',
  ts: 'TypeScript',
  jsx: 'React (JSX)',
  svelte: 'Svelte',
  vue: 'Vue',
  bash: 'Terminal',
  json: 'JSON'
}

/** Resolves an image path of a Markdown file to the URL built by Vite. */
function imageUrl(src: string, from: '' | 'docs/'): string {
  if (/^https?:/.test(src)) return src
  const path = '/' + (from + src).replace(/^docs\/\.\.\//, '')
  return IMAGES[path] ?? src
}

function inline(nodes: Inline[], from: '' | 'docs/'): Child[] {
  return nodes.map((n) => {
    switch (n.t) {
      case 'text':
        return n.text
      case 'code':
        return h('code', null, n.text)
      case 'strong':
        return h('strong', null, inline(n.children, from))
      case 'em':
        return h('em', null, inline(n.children, from))
      case 'link':
        return h('a', { href: siteHref(n.href, from) }, inline(n.children, from))
      case 'img':
        return h('img', { src: imageUrl(n.src, from), alt: n.alt, loading: 'lazy' })
    }
  })
}

const text = (s: string, from: '' | 'docs/') => inline(parseInline(s), from)

/** Raw HTML of a Markdown file (the README banner): our own content, with image paths resolved. */
const rawHtml = (html: string, from: '' | 'docs/') =>
  html.replace(/(src|srcset)="([^"]+)"/g, (_, attr: string, v: string) => `${attr}="${imageUrl(v, from)}"`)

function block(b: Block, from: '' | 'docs/', key: number): Child {
  switch (b.t) {
    case 'heading':
      return h(`h${Math.min(b.level, 4)}`, { key, id: b.id }, text(b.text, from))
    case 'paragraph':
      return h('p', { key }, text(b.text, from))
    case 'list':
      return h(b.ordered ? 'ol' : 'ul', { key, class: 'doc-list' }, b.items.map((it, i) => h('li', { key: i }, text(it, from))))
    case 'quote':
      return h('div', { key, class: 'callout' }, h('span', null, text(b.text, from)))
    case 'table':
      return h(
        'div',
        { key, class: 'table' },
        h(
          'table',
          null,
          h('thead', null, h('tr', null, b.head.map((c, i) => h('th', { key: i }, text(c, from))))),
          h('tbody', null, b.rows.map((r, i) => h('tr', { key: i }, r.map((c, j) => h('td', { key: j }, text(c, from))))))
        )
      )
    case 'code':
      return b.live
        ? h('div', { key, class: 'doc-duo' }, c(CodeBlock, { code: b.code, title: LANG_TITLE[b.lang] ?? b.lang }), c(Preview, { example: b.code, caption: 'Live: this very code.' }))
        : h('div', { key }, c(CodeBlock, { code: b.code, title: LANG_TITLE[b.lang] ?? b.lang }))
    case 'html':
      return h('div', { key, class: 'doc-html', innerHTML: rawHtml(b.html, from) })
    case 'rule':
      return h('hr', { key })
  }
}

/** The page asked for in the address (`/docs?page=reference`), or the first guide. */
function currentPage(): DocPage {
  const id = typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get('page') ?? ''
  return PAGES.find((p) => p.id === id) ?? PAGES.find((p) => p.id === 'getting-started') ?? PAGES[0]!
}

export const Docs: Component<Record<string, never>> = () => {
  initTheme()
  const page = currentPage()
  const blocks = parseMarkdown(page.source)
  const title = blocks.find((b) => b.t === 'heading' && b.level === 1) as { text: string } | undefined
  const body = blocks.filter((b) => !(b.t === 'heading' && b.level === 1))
  const sections = body.filter((b): b is Extract<Block, { t: 'heading' }> => b.t === 'heading' && b.level === 2)
  if (typeof document !== 'undefined') document.title = `${title?.text ?? page.title} | Mochis docs`

  /** Section of the page currently at the top of the screen. */
  const current = ref(sections[0]?.id ?? '')
  let obs: IntersectionObserver | null = null
  onMount(() => {
    if (typeof IntersectionObserver === 'undefined') return
    obs = new IntersectionObserver(
      (es) => {
        for (const e of es) if (e.isIntersecting) current.value = e.target.id
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )
    for (const s of sections) {
      const el = document.getElementById(s.id)
      if (el) obs.observe(el)
    }
    // the browser jumped before the page was drawn: jump again to the anchor
    if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView()
  })
  onUnmount(() => obs?.disconnect())

  return () =>
    h(
      'div',
      { style: 'display: contents' },
      c(Nav, { home: '/', page: 'docs' }),
      h(
        'main',
        { class: 'docs' },
        h(
          'header',
          { class: 'docs-head wrap' },
          h('p', { class: 'eyebrow' }, 'Documentation'),
          h('h1', { class: 'docs-title' }, title?.text ?? page.title),
          h('p', { class: 'note' }, 'This page is ', h('a', { href: `https://github.com/robinnat/mochi/blob/main/${page.file}` }, page.file), ' of the repository.')
        ),
        h(
          'div',
          { class: 'wrap docs-grid' },
          h(
            'aside',
            { class: 'docs-toc', 'aria-label': 'Documentation' },
            GROUPS.map((g) =>
              h(
                'div',
                { key: g.title },
                h('p', { class: 'docs-toc-title' }, g.title),
                h(
                  'ul',
                  null,
                  g.ids.map((id) => {
                    const p = PAGES.find((x) => x.id === id)!
                    return h(
                      'li',
                      { key: id },
                      h('a', { href: `/docs?page=${id}`, 'aria-current': id === page.id ? 'page' : undefined }, p.title),
                      id === page.id && sections.length
                        ? h(
                            'ul',
                            { class: 'docs-toc-sub' },
                            sections.map((s) => h('li', { key: s.id }, h('a', { href: '#' + s.id, 'aria-current': current.value === s.id ? 'true' : undefined }, text(s.text, page.from))))
                          )
                        : null
                    )
                  })
                )
              )
            )
          ),
          h('article', { class: 'docs-body doc' }, body.map((b, i) => block(b, page.from, i)))
        )
      ),
      c(Footer, {})
    )
}

export { slug }
