// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { monterApp } from '@/ui/dom/h'
import { nextTick } from '@/ui/dom/reactif'
import { defaultCycle, type Block } from '@/bot/cycles'
import { TimelineTrack } from './TimelineTrack'

/**
 * Deux correctifs releves en QA (10/11/2026) :
 * - au doigt, une carte de la timeline ne se deplacait pas : sans `touch-action: none`, le navigateur prend le
 *   glisser pour un defilement de la piste et annule le pointeur (pointercancel) apres quelques pixels ;
 * - le panneau ferme n'etait que transparent (opacity 0) : ses champs restaient atteignables au clavier.
 */

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

const hote = () => {
  const d = document.createElement('div')
  document.body.appendChild(d)
  return d
}

describe('timeline au doigt', () => {
  it('chaque carte et chaque poignee de duree refusent le defilement tactile (touch-none)', async () => {
    const blocks = defaultCycle().blocks
    const demonter = monterApp(TimelineTrack, hote(), {
      blocks,
      elapsed: 0,
      shape: 'cercle',
      color: 'encre',
      expression: 'neutre',
      block: 0,
      zoom: 1,
      onBlock: () => {},
      onZoom: () => {},
      onBlocks: () => {},
      onSeek: () => {},
      onAdd: () => {}
    })
    await nextTick()
    const cartes = [...document.querySelectorAll<HTMLElement>('[data-carte]')]
    expect(cartes.length).toBe(blocks.length)
    for (const carte of cartes) expect(carte.classList.contains('touch-none')).toBe(true)
    const poignees = [...document.querySelectorAll<HTMLElement>('.cursor-ew-resize[aria-label]')]
    expect(poignees.length).toBe(blocks.length)
    for (const p of poignees) expect(p.classList.contains('touch-none')).toBe(true)
    demonter()
  })
})

describe('timeline : la carte tombe la ou le doigt se leve', () => {
  it('meme si le dernier pointermove est perime, le pointerup decide de la place', async () => {
    const blocks = defaultCycle().blocks
    let recu: Block[] | null = null
    const demonter = monterApp(TimelineTrack, hote(), {
      blocks,
      elapsed: 0,
      shape: 'cercle',
      color: 'encre',
      expression: 'neutre',
      block: 0,
      zoom: 1,
      onBlock: () => {},
      onZoom: () => {},
      onBlocks: (b: Block[]) => (recu = b),
      onSeek: () => {},
      onAdd: () => {}
    })
    await nextTick()
    const carte = document.querySelector<HTMLElement>('[data-carte]')!
    // happy-dom n'a pas de capture de pointeur
    carte.setPointerCapture = () => {}
    // abscisse du milieu de la 3e carte, d'apres la largeur posee en style (la piste commence a 0)
    const largeurs = [...document.querySelectorAll<HTMLElement>('[data-carte]')].map((c) => parseFloat(c.parentElement!.style.width))
    const x = largeurs[0]! + largeurs[1]! + largeurs[2]! / 2
    const pe = (type: string, clientX: number) => new PointerEvent(type, { bubbles: true, clientX, pointerId: 1, pointerType: 'touch' })
    carte.dispatchEvent(pe('pointerdown', 10))
    // un seul mouvement, perime : il ne quitte presque pas la premiere carte
    carte.dispatchEvent(pe('pointermove', 30))
    carte.dispatchEvent(pe('pointerup', x))
    expect(recu).not.toBeNull()
    expect(recu!.map((b) => b.state)).toEqual([blocks[1]!.state, blocks[2]!.state, blocks[0]!.state, ...blocks.slice(3).map((b) => b.state)])
    demonter()
  })
})

describe('panneaux fermes hors du clavier', () => {
  it('un panneau ferme est inert et aria-hidden, un panneau ouvert ne l est pas', async () => {
    const { App } = await import('@/App')
    const racine = hote()
    const demonter = monterApp(App, racine)
    await nextTick()
    const panneaux = [...racine.querySelectorAll<HTMLElement>('aside.panneau')]
    expect(panneaux.length).toBe(2)
    // au demarrage, les reglages (gauche) sont fermes
    const gauche = racine.querySelector<HTMLElement>('.scene__gauche')!
    expect(gauche.classList.contains('panneau--ouvert')).toBe(false)
    expect(gauche.hasAttribute('inert')).toBe(true)
    expect(gauche.getAttribute('aria-hidden')).toBe('true')
    for (const p of panneaux) {
      const ouvert = p.classList.contains('panneau--ouvert')
      expect(p.hasAttribute('inert'), p.className).toBe(!ouvert)
      expect(p.getAttribute('aria-hidden'), p.className).toBe(ouvert ? null : 'true')
    }
    demonter()
  })
})
