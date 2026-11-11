import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseInline } from './markdown'

describe('parseInline', () => {
  it('reads an image inside a link (a badge) as a link around the image', () => {
    expect(parseInline('[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) and more')).toEqual([
      { t: 'link', href: 'LICENSE', children: [{ t: 'img', alt: 'License: MIT', src: 'https://img.shields.io/badge/license-MIT-blue.svg' }] },
      { t: 'text', text: ' and more' }
    ])
  })

  it('still reads plain links, images, code, bold and italics', () => {
    expect(parseInline('[a](b.md) ![c](d.png) `e` **f** *g*')).toEqual([
      { t: 'link', href: 'b.md', children: [{ t: 'text', text: 'a' }] },
      { t: 'text', text: ' ' },
      { t: 'img', alt: 'c', src: 'd.png' },
      { t: 'text', text: ' ' },
      { t: 'code', text: 'e' },
      { t: 'text', text: ' ' },
      { t: 'strong', children: [{ t: 'text', text: 'f' }] },
      { t: 'text', text: ' ' },
      { t: 'em', children: [{ t: 'text', text: 'g' }] }
    ])
  })

  it('leaves no Markdown syntax as text in the README (what /docs?page=overview shows)', () => {
    for (const line of readFileSync(new URL('../../README.md', import.meta.url), 'utf8').split('\n')) {
      if (/^\s*(```|<|#|\||    )/.test(line)) continue
      for (const n of parseInline(line)) if (n.t === 'text') expect(n.text, line).not.toMatch(/!?\[[^\]]*\]\(/)
    }
  })
})
