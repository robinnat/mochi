import { describe, expect, it } from 'vitest'
import { highlight } from './code'

describe('example highlighting', () => {
  it('escapes all text: the result can go into innerHTML', () => {
    const h = highlight('<script>alert("x")</script> & <img onerror=1>')
    expect(h).not.toMatch(/<script|<img/)
    expect(h).toContain('&lt;')
    expect(h).toContain('&amp;')
    // once the highlighting tags are removed, we find exactly the original text
    const text = h.replace(/<\/?span[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    expect(text).toBe('<script>alert("x")</script> & <img onerror=1>')
  })

  it('colors tags, attributes, strings, keywords and comments', () => {
    const h = highlight('<mochi-bot shape="star" size="200"></mochi-bot>\n// note\nimport x from \'y\'')
    expect(h).toContain('<span class="c-tag">&lt;mochi-bot</span>')
    expect(h).toContain('<span class="c-attr">shape</span>')
    expect(h).toContain('<span class="c-str">&quot;star&quot;</span>')
    expect(h).toContain('<span class="c-attr">size</span>')
    expect(h).toContain('<span class="c-com">// note</span>')
    expect(h).toContain('<span class="c-word">import</span>')
  })
})

describe('shell examples (/docs)', () => {
  it('a URL is not a comment: the clone command keeps its address in plain text', () => {
    const h = highlight('git clone https://github.com/robinnat/mochi.git')
    expect(h).not.toContain('c-com')
    expect(h.replace(/<\/?span[^>]*>/g, '')).toBe('git clone https://github.com/robinnat/mochi.git')
  })

  it('a # after a space is a shell comment, a hex color is not', () => {
    expect(highlight('npx pnpm@11.17.0 test       # tests (vitest)')).toContain('<span class="c-com"># tests (vitest)</span>')
    expect(highlight("color: '#ff8800'")).not.toContain('c-com')
    expect(highlight('<mochi-bot color="#f80"></mochi-bot>')).not.toContain('c-com')
  })

  it('a JavaScript comment is still a comment', () => {
    expect(highlight('const a = 1 // one')).toContain('<span class="c-com">// one</span>')
  })
})
