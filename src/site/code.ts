/**
 * Minimal syntax highlighting of the site's examples (HTML, TypeScript, shell), in a single regular expression pass:
 * comments, strings, tags, attributes, keywords, numbers. The text is ALWAYS escaped before being wrapped, so the
 * result can safely go into `innerHTML`.
 */

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const WORDS = 'import|from|export|const|let|new|function|return|await|async|type|interface|if|else|true|false|null|undefined'

const TOKEN = new RegExp(
  [
    // `//` after a colon is a URL (https://...), not a comment; `# ` after a space is a shell comment, `#f80` a color
    '(?<com><!--[\\s\\S]*?-->|(?<!:)\\/\\/[^\\n]*|^#[^\\n]*|(?<=[ \\t])# [^\\n]*)',
    '(?<str>"(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\'|`(?:[^`\\\\]|\\\\.)*`)',
    '(?<tag><\\/?[A-Za-z][\\w-]*|\\/?>)',
    '(?<attr>[:@]?[A-Za-z][\\w-]*(?==))',
    `(?<word>\\b(?:${WORDS})\\b)`,
    '(?<num>\\b\\d+(?:\\.\\d+)?\\b)',
    '(?<cmd>^\\$ )'
  ].join('|'),
  'gm'
)

export function highlight(code: string): string {
  let out = ''
  let last = 0
  for (const m of code.matchAll(TOKEN)) {
    const i = m.index ?? 0
    out += escape(code.slice(last, i))
    const g = m.groups ?? {}
    const cls = g.com ? 'c-com' : g.str ? 'c-str' : g.tag ? 'c-tag' : g.attr ? 'c-attr' : g.word ? 'c-word' : g.num ? 'c-num' : 'c-cmd'
    out += `<span class="${cls}">${escape(m[0])}</span>`
    last = i + m[0].length
  }
  return out + escape(code.slice(last))
}
