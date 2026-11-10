import { createApp, h } from 'vue'
import MochiBot from '../src/components/MochiBot.vue'
import { POSES, STATE_BY_ID, type StateId } from '../src/bot/states'

const mode = new URLSearchParams(location.search).get('mode') ?? 'states'
const ETATS: StateId[] = ['idle', 'thinking', 'wink', 'wide', 'sleep']

// planche : 5 etats, une ligne de 150 px
function planche() {
  return ETATS.map((id, i) =>
    h('div', { class: 'c', style: `left:${i * 150}px; top:0px` }, [
      h(MochiBot, { size: 150, shape: 'cercle', color: ['rouge', 'vert', 'ciel', 'magenta', 'orange'][i], rendu: 'original', state: id, frozenAt: POSES[id], label: '' })
    ])
  )
}

// demo : repos, clin d'oeil, yeux ecarquilles, sommeil ; chaque etat depuis le repos, 15 images par seconde
const FPS = 15
function demo() {
  const segs: [StateId, number][] = [
    ['idle', 1.6],
    ['wink', STATE_BY_ID.get('wink')?.duration ?? 1.4],
    ['wide', STATE_BY_ID.get('wide')?.duration ?? 1.8],
    ['sleep', STATE_BY_ID.get('sleep')?.duration ?? 2.4]
  ]
  const frames: { id: StateId; t: number }[] = []
  for (const [id, d] of segs) for (let k = 0; k < Math.round(d * FPS); k++) frames.push({ id, t: k / FPS })
  document.title = String(frames.length)
  return frames.map((f, i) =>
    h('div', { class: 'c', style: `left:${(i % 12) * 300}px; top:${Math.floor(i / 12) * 300}px` }, [
      h(MochiBot, { size: 300, shape: 'cercle', color: 'ciel', rendu: 'original', state: f.id, frozenAt: f.t, label: '' })
    ])
  )
}

createApp({ render: () => (mode === 'demo' ? demo() : planche()) }).mount('#r')
