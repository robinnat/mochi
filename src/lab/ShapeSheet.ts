import { h, type Component } from '@/ui/dom/h'
import 'mochiz'
import { SHAPES, type RenderStyleId } from 'mochiz'
import { sizeCell } from './width'

/** The three styles, all in 3D: Soft, Flat and Pixel. */
const STYLES: { id: RenderStyleId; name: string }[] = [
  { id: '3d', name: 'Soft' },
  { id: 'flat3d', name: 'Flat' },
  { id: 'pixel3d', name: 'Pixel' }
]

export const ShapeSheet: Component<Record<string, never>> = () => {
  // `?c=`: color of the sheet (by default, the engine's chosen color)
  const q = new URLSearchParams(location.search)
  const color = q.get('c') ?? 'ink'
  const size = sizeCell(120, STYLES.length, 90)
  const t = Number(q.get('t')) || 1.2
  return () =>
    h(
      'main',
      { class: 'p-4' },
      h('h1', { class: 'mb-3 text-lg font-bold' }, 'Shapes x styles'),
      h(
        'div',
        { class: 'max-w-full overflow-x-auto' },
        h(
          'div',
          { class: 'grid items-center gap-2', style: { gridTemplateColumns: `90px repeat(${STYLES.length}, ${size}px)` } },
          h('div'),
          STYLES.map((s) => h('div', { key: s.id, class: 'text-center text-xs font-semibold' }, s.name)),
          SHAPES.map((f) => [
            h('div', { key: f.id, class: 'text-xs text-[var(--muted)]' }, f.id),
            STYLES.map((s) =>
              h('mochi-bot', {
                key: `${f.id}-${s.id}`,
                size: size,
                shape: f.id,
                color: color,
                renderStyle: s.id,
                frozenAt: t,
                cycle: [{ state: 'idle', duration: 3 }],
                'data-cell': `${f.id}-${s.id}`
              })
            )
          ])
        )
      )
    )
}
