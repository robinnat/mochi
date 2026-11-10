// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { BotEngine, type BotFrame } from '@/bot/engine'
import { blockAt, defaultCycle, offsetOf, type Block } from '@/bot/cycles'
import { RADIUS } from '@/bot/frame'
import { SHAPE_BY_ID } from '@/bot/skins'
import { EXPRESSION_BY_ID } from '@/bot/expressions'
import { opensCycle } from './capture'
import { HALF_SCREEN, viewBoxExport } from './export'

/**
 * Le lecteur hors ecran, celui qui rend les images d'un export de montage.
 *
 * Il demande un DOM, d'ou l'environnement `happy-dom` en tete de fichier.
 *
 * Ce qu'il attrape n'est visible d'aucune autre facon qu'en regardant un MP4 image par
 * image, et c'est precisement ce qui l'a laisse passer : trois defauts abimaient
 * silencieusement chaque video exportee.
 */

/**
 * happy-dom n'a pas de WebGL : la scene 3D est remplacee par un double qui retient l'image du moteur qu'on lui
 * demande de rendre. C'est exactement ce que la vraie 3D recevrait, donc ce que l'export capture.
 */
const scene = vi.hoisted(() => ({ webgl: true, last: null as null | { bodyPath: string; eyes: { matrix: string }[] } }))
vi.mock('@/ui/3d/scene3d', () => ({
  webglAvailable: () => scene.webgl,
  renderAvatar: (_target: unknown, frame: BotFrame) => {
    scene.last = frame
  },
  invalidateAccessories3d: () => {},
  warmUp: () => {}
}))

const SETTINGS = { shape: 'circle', color: 'ink', expression: 'neutral' }
const SIZE = 128

/** Le `d` du corps de la derniere image envoyee a la 3D. */
function bodyOf(_svg: SVGSVGElement) {
  return scene.last!.bodyPath
}

/** Les matrices des yeux de la derniere image envoyee a la 3D. */
function eyesOf(_svg: SVGSVGElement) {
  return scene.last!.eyes.map((e) => e.matrix)
}

/** Le moteur seul, cale comme `renderAt` le fait : chaque etat date de son offset absolu. */
function engineAtSameInstant(blocks: Block[], t: number) {
  const e = new BotEngine(
    RADIUS,
    blocks[0]!.state,
    SHAPE_BY_ID.get(SETTINGS.shape)!.radii,
    EXPRESSION_BY_ID.get(SETTINGS.expression)!
  )
  const { index } = blockAt(blocks, t)
  for (let i = 1; i <= index; i++) e.setState(blocks[i]!.state, offsetOf(blocks, i))
  return e.sample(t)
}

/**
 * Le cadre de l'export d'un CYCLE doit etre celui que le composant DESSINE, pas un nombre
 * qui lui ressemble.
 *
 * `HALF_SCREEN` valait 158 en dur face a un `VB = 158` ecrit a la main dans le composant, et
 * rien ne reliait les deux. La regression visee : quelqu'un elargit le viewBox pour un
 * nouvel etat aux anneaux plus grands, l'export continue au cadre precedent et ajoute des
 * bandes vides a chaque video, tous les tests au vert.
 *
 * Compare ici au `viewBox` reellement emis, et non a la constante : les deux viennent
 * desormais du meme module, donc une assertion entre elles serait une tautologie. Ce qui
 * peut encore deriver, c'est le GABARIT.
 */
describe('cadre de l export', () => {
  it('exporte le cycle sur le viewBox que le composant dessine', async () => {
    const player = await opensCycle(SETTINGS, defaultCycle().blocks, SIZE)
    try {
      const svg = await player.render(0)
      expect(svg.getAttribute('viewBox')).toBe(viewBoxExport(HALF_SCREEN))
    } finally {
      player.closed()
    }
  })
})

describe('lecteur hors ecran', () => {
  /**
   * Rejouer la sequence doit redonner exactement les memes images.
   *
   * L'export GIF en depend : il fait DEUX passes, une pour recenser la palette et une pour
   * indexer, et la palette de la premiere ne vaut que si la seconde rend les memes images.
   * Un seul lecteur servait aux deux, or il retient le dernier bloc pose et le moteur
   * retient l'etat precedent : rejouer l'image 0 apres une passe complete datait le premier
   * etat a l'instant 0 avec le DERNIER en etat precedent, et rendait donc la pose de
   * celui-la. Le GIF par defaut s'ouvrait sur une boule SANS YEUX — la comete a un
   * `eyeAlpha` nul.
   */
  it('rejoue la sequence a l identique', async () => {
    const blocks = defaultCycle().blocks
    const fresh = await opensCycle(SETTINGS, blocks, SIZE)
    const reference = { body: bodyOf(await fresh.render(0)), eyes: eyesOf(await fresh.render(0)) }
    fresh.closed()

    const replays = await opensCycle(SETTINGS, blocks, SIZE)
    try {
      // une passe complete, grossierement echantillonnee : ce qui compte est d'avoir
      // traverse tous les blocs avant de revenir au debut
      for (let t = 0; t < 30; t += 1.5) await replays.render(t)
      const after = await replays.render(0)
      expect(bodyOf(after)).toBe(reference.body)
      expect(eyesOf(after)).toEqual(reference.eyes)
      expect(eyesOf(after)).toHaveLength(2)
    } finally {
      replays.closed()
    }
  })

  /**
   * L'image rendue doit etre celle du moteur, y compris SUR un joint de bloc.
   *
   * Aux jointures, le composant posait bien l'etat a son offset absolu puis echantillonnait
   * a la bonne date — mais le watcher de `state`, dont la file est videe par le `nextTick`
   * de l'export, repassait derriere un `redrawFrozen()` non inerte (le lecteur est monte
   * avec `frozenAt: 0`). Or `sample(0)` juste apres un changement date plus tard donne un
   * ratio de melange nul, donc la pose de l'etat PRECEDENT : une image fausse a chaque
   * jointure, treize fois dans le montage par defaut.
   */
  it('rend exactement ce que le moteur rend, jointures comprises', async () => {
    const blocks = defaultCycle().blocks
    const player = await opensCycle(SETTINGS, blocks, SIZE)
    try {
      // les dates des jointures elles-memes, plus un point au milieu de chaque bloc
      const dates = blocks.flatMap((b, i) => {
        const start = offsetOf(blocks, i)
        return i === 0 ? [start + b.duration / 2] : [start, start + b.duration / 2]
      })
      for (const t of dates) {
        const svg = await player.render(t)
        const expected = engineAtSameInstant(blocks, t)
        expect(bodyOf(svg), `t=${t.toFixed(2)}`).toBe(expected.bodyPath)
        expect(eyesOf(svg), `t=${t.toFixed(2)}`).toEqual(expected.eyes.map((e) => e.matrix))
      }
    } finally {
      player.closed()
    }
  })

  /**
   * L'image 0 est le PREMIER etat du montage, pas un repos qui morphe vers lui.
   *
   * Le lecteur etait monte sans prop `state`, donc le modele prenait son defaut `idle` et
   * le moteur se construisait dessus : un montage commencant par le sommeil s'ouvrait sur une
   * boule au repos qui morphait vers la petite boule pendant 0,5 s. La lecture a l'ecran ne
   * fait pas ca, elle amorce l'etat sur le bloc courant.
   */
  it('ouvre sur le premier etat du montage, sans morpher depuis le repos', async () => {
    for (const start of ['sleep', 'thinking'] as const) {
      const blocks = [
        { state: start, duration: 2 },
        { state: 'idle' as const, duration: 2 }
      ]
      const player = await opensCycle(SETTINGS, blocks, SIZE)
      try {
        const svg = await player.render(0)
        expect(bodyOf(svg), start).toBe(engineAtSameInstant(blocks, 0).bodyPath)
      } finally {
        player.closed()
      }
    }
  })
})

/** Sans WebGL, pas de dessin 2D de secours : l'export echoue proprement au lieu de sortir une autre image. */
describe('export sans WebGL', () => {
  it('le lecteur hors ecran refuse de begin', async () => {
    scene.webgl = false
    try {
      await expect(opensCycle(SETTINGS, defaultCycle().blocks, SIZE)).rejects.toThrow('3D indisponible')
    } finally {
      scene.webgl = true
    }
  })
})
