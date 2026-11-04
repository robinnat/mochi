import { createApp, h } from 'vue'
import MochiBot from '../src/components/MochiBot.vue'
import { POSES, STATE_BY_ID, type StateId } from '../src/bot/states'

const mode = new URLSearchParams(location.search).get('mode') ?? 'states'
const ETATS: StateId[] = ['idle', 'thinking', 'wink', 'wide', 'alert', 'notify', 'exclaim', 'sleep', 'egg', 'hexagon', 'play', 'orbit', 'swirl', 'burst', 'comet'].filter(
  (e) => e !== 'swirl'
) as StateId[]

// planche : 14 etats, 7 colonnes de 150 px
function planche() {
  return ETATS.map((id, i) =>
    h('div', { class: 'c', style: `left:${(i % 7) * 150}px; top:${Math.floor(i / 7) * 150}px` }, [
      h(MochiBot, { size: 150, shape: 'cercle', color: 'violet', rendu: 'original', state: id, frozenAt: POSES[id], label: '' })
    ])
  )
}

// demo : repos, clin d'oeil, orbite, eclatement ; chaque etat depuis le repos, 15 images par seconde
const FPS = 15
function demo() {
  const segs: [StateId, number][] = [
    ['idle', 1.6],
    ['wink', STATE_BY_ID.get('wink')?.duration ?? 1.4],
    ['orbit', STATE_BY_ID.get('orbit')?.duration ?? 3],
    ['burst', STATE_BY_ID.get('burst')?.duration ?? 2]
  ]
  const frames: { id: StateId; t: number }[] = []
  for (const [id, d] of segs) for (let k = 0; k < Math.round(d * FPS); k++) frames.push({ id, t: k / FPS })
  document.title = String(frames.length)
  return frames.map((f, i) =>
    h('div', { class: 'c', style: `left:${(i % 12) * 300}px; top:${Math.floor(i / 12) * 300}px` }, [
      h(MochiBot, { size: 300, shape: 'cercle', color: 'violet', rendu: 'original', state: f.id, frozenAt: f.t, label: '' })
    ])
  )
}

createApp({ render: () => (mode === 'demo' ? demo() : planche()) }).mount('#r')
