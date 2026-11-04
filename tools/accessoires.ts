import { createApp, h } from 'vue'
import MochiBot from '../src/components/MochiBot.vue'
import { POSES, type StateId } from '../src/bot/states'
import { ACCESSOIRES } from '../src/bot/accessoires'
import { PORTE_IDS } from '../src/bot/portes'

const q = new URLSearchParams(location.search)
const mode = q.get('mode') ?? 'porte'
const rendu = q.get('rendu') ?? 'argile'
const etats = (q.get('etats') ?? 'idle,wink,wide').split(',') as StateId[]
const forme = q.get('forme') ?? 'cercle'
const yaw = (Number(q.get('yaw') ?? 0) * Math.PI) / 180
const taille = Number(q.get('s') ?? 120)
const COULEURS = ['violet', 'rose', 'turquoise', 'ambre', 'bleu', 'vert', 'orange', 'violet', 'rose']
const choisis = q.get('ids')?.split(',')
const ids: string[] = choisis ?? (mode === 'job' ? ACCESSOIRES.map((a) => a.id) : PORTE_IDS)
const couleur = q.get('c')
const cols = mode === 'job' ? 1 : etats.length
const racine = document.getElementById('r')!
racine.style.gridTemplateColumns = `repeat(${choisis ? ids.length * etats.length : cols * (mode === 'job' ? 4 : 1)}, ${taille + 24}px)`

createApp({
  render: () =>
    mode === 'job'
      ? ids.map((id, i) =>
          h('div', { class: 'c' }, [
            h(MochiBot, { size: taille, shape: forme, color: COULEURS[i % 9], rendu: rendu as never, accessoire: id as never, frozenAt: 2.2, yaw, label: id }),
            h('div', { class: 't' }, id)
          ])
        )
      : ids.flatMap((id, i) =>
          etats.map((e) =>
            h('div', { class: 'c' }, [
              h(MochiBot, { size: taille, shape: forme, color: couleur ?? COULEURS[i % 9], rendu: rendu as never, state: e, porte: (id === 'aucun' ? null : id) as never, frozenAt: POSES[e], yaw, label: id }),
              h('div', { class: 't' }, `${id} / ${e}`)
            ])
          )
        )
}).mount(racine)
