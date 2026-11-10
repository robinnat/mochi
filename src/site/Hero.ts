import { computed, ref } from '@/ui/dom/reactif'
import { c, h, type Composant } from '@/ui/dom/h'
import { Affiche } from './Affiche'
import { HeroChiffres } from './HeroChiffres'
import { DEFILE } from './affiches'
import { ACCESSOIRES_SITE } from './catalog'
import type { Choix, Emplacement } from '@/bot/emplacements'

/**
 * Hero : « la foule » (choisi par Robin le 09/11/2026). Aucune 3D au premier ecran : une petite foule de Mochi tous
 * differents, en images pre-rendues qui flottent en CSS. Un tap sur l'un d'eux le fait sauter et dit ce qu'il porte ;
 * « Shuffle » en appelle d'autres de la meme liste soignee que la carte des accessoires. Tres leger sur iPhone.
 */
const DE_FACE = DEFILE.filter((d) => !d.variante.dos)
const NB = 12
const labelDe = (i: number) =>
  (Object.entries(DE_FACE[i]!.variante.acc) as [Emplacement, Choix][])
    .map(([e, ch]) => ACCESSOIRES_SITE(e).find((a) => a.id === (typeof ch === 'string' ? ch : ch.id))?.label)
    .filter(Boolean)
    .join(', ')

export const Hero: Composant<Record<string, never>> = () => {
  const ordre = ref<number[]>(Array.from({ length: NB }, (_, i) => i))
  const foule = computed(() => ordre.value.map((i) => ({ i, nom: DE_FACE[i]!.nom })))
  const actif = ref<number | null>(null)
  const saut = ref(0)

  function toucher(i: number) {
    actif.value = i
    saut.value++
  }
  function melanger() {
    const tout = DE_FACE.map((_, i) => i)
    for (let k = tout.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1))
      ;[tout[k], tout[j]] = [tout[j]!, tout[k]!]
    }
    ordre.value = tout.slice(0, NB)
    actif.value = null
  }
  const legende = computed(() => (actif.value === null ? 'Tap a Mochi to see what it wears.' : `Wearing: ${labelDe(actif.value)}.`))

  return () =>
    h(
      'header',
      { id: 'top', class: 'hx hx-b' },
      h('div', { class: 'hero-fond', 'aria-hidden': 'true' }),
      h(
        'div',
        { class: 'hx-in hx-centre' },
        h('p', { class: 'hero-badge rv-load', style: '--d: 0' }, h('span', { class: 'point', 'aria-hidden': 'true' }), ' Open source, MIT'),
        h('h1', { class: 'hx-titre rv-load', style: '--d: 1' }, 'A crowd of ', h('span', { class: 'accent' }, 'tiny faces'), ' for your app.'),
        h(
          'p',
          { class: 'hx-chapo rv-load', style: '--d: 2' },
          'Mochi is a 3D avatar for the web: pick a shape, a colour and a few accessories. Each one breathes, blinks and reacts to touch.'
        ),
        h(
          'div',
          { class: 'actions hx-actions rv-load', style: '--d: 3' },
          h('a', { class: 'btn primaire', href: '/app' }, 'Try the app ', h('span', { 'aria-hidden': 'true' }, '→')),
          h('a', { class: 'btn', href: '/docs' }, 'Read the docs')
        ),
        h(
          'ul',
          { class: 'hx-foule', 'aria-label': 'Some Mochi' },
          foule.value.map((m, k) =>
            h(
              'li',
              { key: m.i + '-' + k, style: { '--k': k } },
              h(
                'button',
                {
                  type: 'button',
                  class: ['hx-mochi', { saute: actif.value === m.i }],
                  'aria-label': DE_FACE[m.i]!.variante.forme + ' Mochi wearing ' + labelDe(m.i),
                  onClick: () => toucher(m.i)
                },
                // la cle change a chaque tap : le saut repart du debut
                h('span', { key: actif.value === m.i ? saut.value : 0, class: 'hx-mochi-i' }, c(Affiche, { nom: m.nom, taille: 166, eager: k < 4 }))
              )
            )
          )
        ),
        h(
          'div',
          { class: 'hx-pied' },
          h('p', { class: 'hx-legende', 'aria-live': 'polite' }, legende.value),
          h('button', { type: 'button', class: 'btn petit', onClick: melanger }, 'Shuffle')
        )
      ),
      c(HeroChiffres, {})
    )
}
