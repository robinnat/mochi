// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountApp } from '@/ui/dom/h'
import { nextTick } from '@/ui/dom/reactive'
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

const host = () => {
  const d = document.createElement('div')
  document.body.appendChild(d)
  return d
}

describe('timeline au doigt', () => {
  it('chaque carte et chaque poignee de duree refusent le defilement tactile (touch-none)', async () => {
    const blocks = defaultCycle().blocks
    const unmount = mountApp(TimelineTrack, host(), {
      blocks,
      elapsed: 0,
      shape: 'circle',
      color: 'ink',
      expression: 'neutral',
      block: 0,
      zoom: 1,
      onBlock: () => {},
      onZoom: () => {},
      onBlocks: () => {},
      onSeek: () => {},
      onAdd: () => {}
    })
    await nextTick()
    const cards = [...document.querySelectorAll<HTMLElement>('[data-carte]')]
    expect(cards.length).toBe(blocks.length)
    for (const card of cards) expect(card.classList.contains('touch-none')).toBe(true)
    const poignees = [...document.querySelectorAll<HTMLElement>('.cursor-ew-resize[aria-label]')]
    expect(poignees.length).toBe(blocks.length)
    for (const p of poignees) expect(p.classList.contains('touch-none')).toBe(true)
    unmount()
  })
})

describe('timeline : la carte tombe la ou le doigt se leve', () => {
  it('meme si le dernier pointermove est perime, le pointerup decide de la place', async () => {
    const blocks = defaultCycle().blocks
    let received: Block[] | null = null
    const unmount = mountApp(TimelineTrack, host(), {
      blocks,
      elapsed: 0,
      shape: 'circle',
      color: 'ink',
      expression: 'neutral',
      block: 0,
      zoom: 1,
      onBlock: () => {},
      onZoom: () => {},
      onBlocks: (b: Block[]) => (received = b),
      onSeek: () => {},
      onAdd: () => {}
    })
    await nextTick()
    const card = document.querySelector<HTMLElement>('[data-carte]')!
    // happy-dom n'a pas de capture de pointeur
    card.setPointerCapture = () => {}
    // abscisse du milieu de la 3e carte, d'apres la largeur posee en style (la piste commence a 0)
    const widths = [...document.querySelectorAll<HTMLElement>('[data-carte]')].map((c) => parseFloat(c.parentElement!.style.width))
    const x = widths[0]! + widths[1]! + widths[2]! / 2
    const pe = (type: string, clientX: number) => new PointerEvent(type, { bubbles: true, clientX, pointerId: 1, pointerType: 'touch' })
    card.dispatchEvent(pe('pointerdown', 10))
    // un seul mouvement, perime : il ne quitte presque pas la premiere carte
    card.dispatchEvent(pe('pointermove', 30))
    card.dispatchEvent(pe('pointerup', x))
    expect(received).not.toBeNull()
    expect(received!.map((b) => b.state)).toEqual([blocks[1]!.state, blocks[2]!.state, blocks[0]!.state, ...blocks.slice(3).map((b) => b.state)])
    unmount()
  })
})

describe('panneaux fermes hors du clavier', () => {
  it('un panneau ferme est inert et aria-hidden, un panneau ouvert ne l est pas', async () => {
    const { App } = await import('@/App')
    const root = host()
    const unmount = mountApp(App, root)
    await nextTick()
    const panels = [...root.querySelectorAll<HTMLElement>('aside.panneau')]
    expect(panels.length).toBe(2)
    // au demarrage, les reglages (gauche) sont fermes
    const left = root.querySelector<HTMLElement>('.scene__gauche')!
    expect(left.classList.contains('panel--open')).toBe(false)
    expect(left.hasAttribute('inert')).toBe(true)
    expect(left.getAttribute('aria-hidden')).toBe('true')
    for (const p of panels) {
      const open = p.classList.contains('panel--open')
      expect(p.hasAttribute('inert'), p.className).toBe(!open)
      expect(p.getAttribute('aria-hidden'), p.className).toBe(open ? null : 'true')
    }
    unmount()
  })
})
