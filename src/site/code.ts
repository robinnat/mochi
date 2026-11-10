/**
 * Coloration syntaxique minimale des exemples du site (HTML, TypeScript, shell), en une seule passe
 * d'expression reguliere : commentaires, chaines, balises, attributs, mots-cles, nombres. Le texte est
 * TOUJOURS echappe avant d'etre enveloppe, le resultat peut donc aller dans `innerHTML` sans risque.
 */

const echapper = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const MOTS = 'import|from|export|const|let|new|function|return|await|async|type|interface|if|else|true|false|null|undefined'

const JETON = new RegExp(
  [
    '(?<com><!--[\\s\\S]*?-->|\\/\\/[^\\n]*|^#[^\\n]*)',
    '(?<str>"(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\'|`(?:[^`\\\\]|\\\\.)*`)',
    '(?<tag><\\/?[A-Za-z][\\w-]*|\\/?>)',
    '(?<attr>[:@]?[A-Za-z][\\w-]*(?==))',
    `(?<mot>\\b(?:${MOTS})\\b)`,
    '(?<num>\\b\\d+(?:\\.\\d+)?\\b)',
    '(?<cmd>^\\$ )'
  ].join('|'),
  'gm'
)

export function surligner(code: string): string {
  let out = ''
  let dernier = 0
  for (const m of code.matchAll(JETON)) {
    const i = m.index ?? 0
    out += echapper(code.slice(dernier, i))
    const g = m.groups ?? {}
    const classe = g.com ? 'c-com' : g.str ? 'c-str' : g.tag ? 'c-tag' : g.attr ? 'c-attr' : g.mot ? 'c-mot' : g.num ? 'c-num' : 'c-cmd'
    out += `<span class="${classe}">${echapper(m[0])}</span>`
    dernier = i + m[0].length
  }
  return out + echapper(code.slice(dernier))
}
