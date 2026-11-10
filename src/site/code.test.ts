import { describe, expect, it } from 'vitest'
import { surligner } from './code'

describe('coloration des exemples', () => {
  it('echappe tout le texte : le resultat peut aller dans innerHTML', () => {
    const h = surligner('<script>alert("x")</script> & <img onerror=1>')
    expect(h).not.toMatch(/<script|<img/)
    expect(h).toContain('&lt;')
    expect(h).toContain('&amp;')
    // une fois les balises de coloration retirees, on retrouve exactement le texte d origine
    const texte = h.replace(/<\/?span[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    expect(texte).toBe('<script>alert("x")</script> & <img onerror=1>')
  })

  it('colore balises, attributs, chaines, mots-cles et commentaires', () => {
    const h = surligner('<mochi-bot shape="etoile" size="200"></mochi-bot>\n// note\nimport x from \'y\'')
    expect(h).toContain('<span class="c-tag">&lt;mochi-bot</span>')
    expect(h).toContain('<span class="c-attr">shape</span>')
    expect(h).toContain('<span class="c-str">&quot;etoile&quot;</span>')
    expect(h).toContain('<span class="c-attr">size</span>')
    expect(h).toContain('<span class="c-com">// note</span>')
    expect(h).toContain('<span class="c-mot">import</span>')
  })
})
