// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountApp } from '@/ui/dom/h'
import { nextTick } from '@/ui/dom/reactive'
import { defaultCycle, type Block } from '@/bot/cycles'
import { TimelineTrack } from './TimelineTrack'

/**
 * Two fixes found in QA (10/11/2026):
 * - with a finger, a timeline card did not move: without `touch-action: none`, the browser takes the drag for a
 *   scroll of
 *   the track and cancels the pointer (pointercancel) after a few pixels;
 * - the closed panel was only transparent (opacity 0): its fields could still be reached with the keyboard.
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

describe('timeline with a finger', () => {
  it('every card and every duration handle refuses touch scrolling (touch-none)', async () => {
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
    const cards = [...document.querySelectorAll<HTMLElement>('[data-card]')]
    expect(cards.length).toBe(blocks.length)
    for (const card of cards) expect(card.classList.contains('touch-none')).toBe(true)
    const poignees = [...document.querySelectorAll<HTMLElement>('.cursor-ew-resize[aria-label]')]
    expect(poignees.length).toBe(blocks.length)
    for (const p of poignees) expect(p.classList.contains('touch-none')).toBe(true)
    unmount()
  })
})

describe('timeline: the card drops where the finger lifts', () => {
  it('even if the last pointermove is stale, the pointerup decides the place', async () => {
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
    const card = document.querySelector<HTMLElement>('[data-card]')!
    // happy-dom has no pointer capture
    card.setPointerCapture = () => {}
    // abscissa of the middle of the 3rd card, from the width set in style (the track starts at 0)
    const widths = [...document.querySelectorAll<HTMLElement>('[data-card]')].map((c) => parseFloat(c.parentElement!.style.width))
    const x = widths[0]! + widths[1]! + widths[2]! / 2
    const pe = (type: string, clientX: number) => new PointerEvent(type, { bubbles: true, clientX, pointerId: 1, pointerType: 'touch' })
    card.dispatchEvent(pe('pointerdown', 10))
    // a single, stale move: it barely leaves the first card
    card.dispatchEvent(pe('pointermove', 30))
    card.dispatchEvent(pe('pointerup', x))
    expect(received).not.toBeNull()
    expect(received!.map((b) => b.state)).toEqual([blocks[1]!.state, blocks[2]!.state, blocks[0]!.state, ...blocks.slice(3).map((b) => b.state)])
    unmount()
  })
})

describe('panneaux fermes hors du clavier', () => {
  it('a closed panel is inert and aria-hidden, an open panel is not', async () => {
    const { App } = await import('@/App')
    const root = host()
    const unmount = mountApp(App, root)
    await nextTick()
    const panels = [...root.querySelectorAll<HTMLElement>('aside.panel')]
    expect(panels.length).toBe(2)
    // at startup, the settings (left) are closed
    const left = root.querySelector<HTMLElement>('.scene__left')!
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
