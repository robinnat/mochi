import { describe, expect, it } from 'vitest'
import { accessoiresEnCode, extraitCode, type OptionsExtrait } from './extrait'

const base: OptionsExtrait = {
  forme: 'etoile',
  couleur: 'violet',
  rendu: '3d',
  contour: false,
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
    for (const absent of ['rendu=', 'contour', 'ombrage', 'epaisseur', 'accessoires', 'theme', 'ordinateur']) expect(e).not.toContain(absent)
  })

  it('le contour vaut pour les trois styles, le reflet seulement pour Soft, plus aucun ombrage', () => {
    for (const rendu of ['3d', 'flat3d', 'pixel3d'] as const) expect(extraitCode({ ...base, rendu, contour: true })).toContain('    contour')
    expect(extraitCode(base)).not.toContain('ombrage')
    expect(extraitCode({ ...base, reflet: false })).toContain(':reflet="false"')
    expect(extraitCode({ ...base, rendu: 'flat3d', reflet: false })).not.toContain('reflet')
    expect(extraitCode({ ...base, rendu: 'pixel3d' })).toContain('rendu="pixel3d"')
    expect(extraitCode({ ...base, rendu: 'pixel3d' })).not.toContain('pixel=')
  })

  it('l epaisseur du contour est ecrite seulement si elle differe du defaut et si le contour est actif', () => {
    expect(extraitCode({ ...base, contour: true, epaisseur: 1 })).not.toContain('epaisseur')
    expect(extraitCode({ ...base, contour: true, epaisseur: 2.5 })).toContain('    :epaisseur-contour="2.5"')
    expect(extraitCode({ ...base, contour: false, epaisseur: 2.5 })).not.toContain('epaisseur')
  })

  it('theme, ordinateur du mood travaille et accessoires avec leurs couleurs', () => {
    const e = extraitCode({
      ...base,
      mood: 'travaille',
      ordinateur: false,
      theme: 'dark',
      accessoires: { tete: { id: 'casquette', c1: '#2f6fe0', c2: '#ff3b4e' }, yeux: { id: 'rondes', c1: '#26222f', c2: '#26222f' } }
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

  it('couleur libre : le code ecrit l hex choisi, sans contour ni reflet quand le site ne les passe pas', () => {
    const libre: OptionsExtrait = { forme: 'coeur', couleur: '#ff8800', rendu: 'pixel3d', mood: 'repos', accessoires: {}, theme: 'auto', ordinateur: true }
    const e = extraitCode(libre)
    expect(e).toContain('color="#ff8800"')
    expect(e).toContain('shape="coeur"')
    for (const absent of ['contour', 'epaisseur', 'reflet']) expect(e).not.toContain(absent)
    expect(extraitCode({ ...libre, rendu: '3d' })).not.toContain('reflet')
  })
})
