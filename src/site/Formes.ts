import { computed, ref } from '@/ui/dom/reactif'
import { c, h, type Composant } from '@/ui/dom/h'
import { Affiche } from './Affiche'
import { FORMES_3D } from './catalog'
import { STYLES_SITE } from './style'
import type { RenduId } from '@/ui/rendu'
import { reveal, useLargeur } from './motion'

/** Les douze formes, images figees (un rendu chacune, aucune boucle), qui apparaissent en cascade. */
export const Formes: Composant<Record<string, never>> = () => {
  const style = ref<RenduId>('3d')
  const largeur = useLargeur()
  const taille = computed(() => (largeur.value >= 1100 ? 128 : largeur.value >= 760 ? 104 : 88))
  // les `reveal` sont crees une fois : un nouveau a chaque dessin relancerait l'observation
  const rv = [reveal(), reveal(1), reveal(2)]
  const rvForme = FORMES_3D.map((_, i) => reveal(i % 6))
  return () =>
    h(
      'section',
      { id: 'shapes', class: 'sec', 'aria-labelledby': 't-formes' },
      h(
        'div',
        { class: 'wrap sec-tete sec-tete-ligne' },
        h('div', null, h('p', { ref: rv[0], class: 'surtitre' }, 'Shapes'), h('h2', { id: 't-formes', ref: rv[1], class: 'titre-sec' }, 'Twelve shapes.', h('br'), 'Same soul.')),
        h(
          'div',
          { ref: rv[2], class: 'segment', role: 'group', 'aria-label': 'Style of the shapes' },
          STYLES_SITE.map((s) => h('button', { key: s.id, type: 'button', 'aria-pressed': style.value === s.id, onClick: () => (style.value = s.id) }, s.label))
        )
      ),
      h(
        'div',
        { class: 'wrap' },
        h(
          'ul',
          { class: 'formes', 'aria-label': 'The twelve shapes' },
          FORMES_3D.map((f, i) =>
            h(
              'li',
              { key: f.id, ref: rvForme[i] },
              h(
                'div',
                { class: 'forme' },
                h('div', { class: 'forme-image' }, c(Affiche, { nom: `forme-${f.id}-${style.value}`, taille: taille.value, alt: `${f.label} Mochi` })),
                h('span', { class: 'forme-nom' }, f.label),
                h('code', { class: 'forme-id' }, f.id)
              )
            )
          )
        )
      )
    )
}
