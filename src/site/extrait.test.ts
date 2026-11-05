import { describe, expect, it } from 'vitest'
import { accessoiresEnCode, extraitCode, type OptionsExtrait } from './extrait'

const base: OptionsExtrait = {
  forme: 'etoile',
  couleur: 'violet',
  rendu: '3d',
  contour: false,
  ombre: true,
  reflet: true,
  mood: 'repos',
  accessoires: {},
  theme: 'auto',
  ordinateur: true
}

describe('extrait de code de la personnalisation', () => {
  it('est un composant Vue complet qui ne montre que ce qui differe du defaut', () => {
    const e = extraitCode(base)
    expect(e).toContain("import MochiBot from './components/MochiBot.vue'")
    expect(e).toContain('<MochiBot\n    shape="etoile"\n    color="violet"\n    mood="repos"\n    :size="260"\n  />')
    for (const absent of ['rendu=', 'contour', 'ombre', 'accessoires', 'theme', 'ordinateur']) expect(e).not.toContain(absent)
  })

  it('le contour est propre a Flat, le reflet a Soft, l ombre se coupe', () => {
    expect(extraitCode({ ...base, rendu: 'flat3d', contour: true })).toContain('    contour')
    expect(extraitCode({ ...base, contour: true })).not.toContain('contour')
    expect(extraitCode({ ...base, reflet: false })).toContain(':reflet="false"')
    expect(extraitCode({ ...base, rendu: 'flat3d', reflet: false })).not.toContain('reflet')
    expect(extraitCode({ ...base, ombre: false })).toContain(':ombre="false"')
    expect(extraitCode({ ...base, rendu: 'pixel3d' })).toContain('rendu="pixel3d"')
    expect(extraitCode({ ...base, rendu: 'pixel3d' })).not.toContain('pixel=')
  })

  it('theme, ordinateur du mood travaille et accessoires avec leurs couleurs', () => {
    const e = extraitCode({
      ...base,
      mood: 'travaille',
      ordinateur: false,
      theme: 'dark',
      accessoires: { tete: { id: 'casquette', c1: '#2f6fe0', c2: '#e8505b' }, yeux: { id: 'rondes', c1: '#26222f', c2: '#26222f' } }
    })
    expect(e).toContain('mood="travaille"')
    expect(e).toContain(':ordinateur="false"')
    expect(e).toContain('theme="dark"')
    expect(e).toContain(":accessoires=\"{ tete: { id: 'casquette', c1: '#2f6fe0' }, yeux: 'rondes' }\"")
    // l'ordinateur ne s'ecrit que pour le mood travaille
    expect(extraitCode({ ...base, ordinateur: false })).not.toContain('ordinateur')
  })

  it('accessoiresEnCode : vide sans accessoire, id seul avec les couleurs du catalogue', () => {
    expect(accessoiresEnCode({})).toBe('')
    expect(accessoiresEnCode({ bas: 'papillon', dos: 'cape' })).toBe("{ bas: 'papillon', dos: 'cape' }")
  })
})
