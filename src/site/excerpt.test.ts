import { describe, expect, it } from 'vitest'
import { accessoriesAsCode, extraitCode, type OptionsExtrait } from './excerpt'

const base: OptionsExtrait = {
  shape: 'star',
  color: 'violet',
  renderStyle: '3d',
  outline: false,
  highlight: true,
  mood: 'idle',
  accessories: {},
  theme: 'auto',
  laptop: true
}

describe('extrait de code de la personnalisation', () => {
  it('est une balise <mochi-bot> complete qui ne montre que ce qui differe du defaut', () => {
    const e = extraitCode(base)
    expect(e).toBe('<mochi-bot\n  shape="etoile"\n  color="violet"\n  mood="repos"\n  size="260"\n></mochi-bot>')
    for (const absent of ['rendu=', 'outline', 'shading', 'thickness', 'accessories', 'theme', 'laptop']) expect(e).not.toContain(absent)
  })

  it('le contour vaut pour les trois styles, le reflet seulement pour Soft, plus none ombrage', () => {
    for (const renderStyle of ['3d', 'flat3d', 'pixel3d'] as const) expect(extraitCode({ ...base, renderStyle, outline: true })).toContain('contour')
    expect(extraitCode(base)).not.toContain('shading')
    expect(extraitCode({ ...base, highlight: false })).toContain('reflet="false"')
    expect(extraitCode({ ...base, renderStyle: 'flat3d', highlight: false })).not.toContain('highlight')
    expect(extraitCode({ ...base, renderStyle: 'pixel3d' })).toContain('rendu="pixel3d"')
    expect(extraitCode({ ...base, renderStyle: 'pixel3d' })).not.toContain('pixel=')
  })

  it('l epaisseur du contour est ecrite seulement si elle differe du defaut et si le contour est actif', () => {
    expect(extraitCode({ ...base, outline: true, thickness: 1 })).not.toContain('thickness')
    expect(extraitCode({ ...base, outline: true, thickness: 2.5 })).toContain('  epaisseur-contour="2.5"')
    expect(extraitCode({ ...base, outline: false, thickness: 2.5 })).not.toContain('thickness')
  })

  it('theme, ordinateur du mood travaille et accessoires avec leurs couleurs', () => {
    const e = extraitCode({
      ...base,
      mood: 'working',
      laptop: false,
      theme: 'dark',
      accessories: { head: { id: 'cap', c1: '#2f6fe0', c2: '#ff3b30' }, eyes: { id: 'round', c1: '#26222f', c2: '#26222f' } }
    })
    expect(e).toContain('mood="travaille"')
    expect(e).toContain('ordinateur="false"')
    expect(e).toContain('theme="dark"')
    expect(e).toContain(`accessories='{"head":{"id":"cap","c1":"#2f6fe0"},"eyes":"round"}'`)
    // l'attribut est du JSON valide, lu tel quel par le composant
    const json = e.match(/accessoires='([^']+)'/)![1]!
    expect(JSON.parse(json)).toEqual({ head: { id: 'cap', c1: '#2f6fe0' }, eyes: 'round' })
    // l'ordinateur ne s'ecrit que pour le mood travaille
    expect(extraitCode({ ...base, laptop: false })).not.toContain('laptop')
  })

  it('accessoiresEnCode : vide sans accessoire, id seul avec les couleurs du catalogue', () => {
    expect(accessoriesAsCode({})).toBe('')
    expect(accessoriesAsCode({ neck: 'bowtie', back: 'cape' })).toBe("{ bas: 'papillon', dos: 'cape' }")
  })

  it('couleur free : le code ecrit l hex choisi, sans contour ni reflet quand le site ne les passe pas', () => {
    const free: OptionsExtrait = { shape: 'heart', color: '#ff8800', renderStyle: 'pixel3d', mood: 'idle', accessories: {}, theme: 'auto', laptop: true }
    const e = extraitCode(free)
    expect(e).toContain('color="#ff8800"')
    expect(e).toContain('shape="coeur"')
    for (const absent of ['outline', 'thickness', 'highlight']) expect(e).not.toContain(absent)
    expect(extraitCode({ ...free, renderStyle: '3d' })).not.toContain('highlight')
  })
})
