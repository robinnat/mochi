import { h, rendre } from '../src/ui/dom/h'
import '../src/components/mochi-bot'
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

const formesListe = q.get('formes')?.split(',')
const porteUnique = (q.get('ids') ?? 'aucun').split(',')[0]!
if (formesListe) racine.style.gridTemplateColumns = `repeat(${Math.min(formesListe.length, Number(q.get('cols') ?? 6))}, ${taille + 24}px)`

rendre(
  h(
    'div',
    { style: 'display: contents' },
    formesListe
      ? formesListe.map((f, i) =>
          h('div', { class: 'c' }, [
            h('mochi-bot', { size: taille, shape: f, color: couleur ?? COULEURS[i % 9], rendu: rendu as never, state: etats[0]!, porte: (porteUnique === 'aucun' ? null : porteUnique) as never, frozenAt: POSES[etats[0]!], yaw, label: f }),
            h('div', { class: 't' }, f)
          ])
        )
      : mode === 'job'
      ? ids.map((id, i) =>
          h('div', { class: 'c' }, [
            h('mochi-bot', { size: taille, shape: forme, color: COULEURS[i % 9], rendu: rendu as never, accessoire: id as never, frozenAt: 2.2, yaw, label: id }),
            h('div', { class: 't' }, id)
          ])
        )
      : ids.flatMap((id, i) =>
          etats.map((e) =>
            h('div', { class: 'c' }, [
              h('mochi-bot', { size: taille, shape: forme, color: couleur ?? COULEURS[i % 9], rendu: rendu as never, state: e, porte: (id === 'aucun' ? null : id) as never, frozenAt: POSES[e], yaw, label: id }),
              h('div', { class: 't' }, `${id} / ${e}`)
            ])
          )
        )
  ),
  racine
)
