import { computed, lien } from '@/ui/dom/reactif'
import { h, type Composant } from '@/ui/dom/h'
import { t } from '@/i18n'
import { FONDS_GIF, FORMATS_CYCLE, cycleAccepteTransparence, videoPossible, type FondGif, type FormatCycle } from '@/ui/export'
import { boiteModale, BOUTON_PRINCIPAL, BOUTON_SECONDAIRE } from './dialogue'

/**
 * Choix du format avant d'exporter le montage. Le groupe « fond » n'apparait QUE pour le GIF : la video n'a pas de
 * canal alpha du tout.
 */
export interface CycleDialogProps {
  avancement: number | null
  /** true = le dernier essai a echoue. La boite le dit et propose de reessayer. */
  erreur: boolean
  open: boolean
  format: FormatCycle
  fond: FondGif
  onOpen: (v: boolean) => void
  onFormat: (v: FormatCycle) => void
  onFond: (v: FondGif) => void
  onConfirm: () => void
  onAnnuler: () => void
}

export const CycleDialog: Composant<CycleDialogProps> = (props) => {
  const open = lien(() => props.open, (v) => props.onOpen(v))
  const boite = boiteModale(open)

  /**
   * La video n'est proposee que la ou le navigateur sait encoder. Le garde vient de `export.ts` et SURTOUT PAS de
   * `video.ts` : l'importer d'ici ramenerait mediabunny dans le morceau d'entree.
   */
  const formats = FORMATS_CYCLE.filter((f) => f !== 'mp4' || videoPossible())
  // le modele est corrige, pas seulement la liste : une valeur cachee ne doit pas gagner
  if (!formats.includes(props.format)) props.onFormat(formats[0]!)

  const occupe = computed(() => props.avancement !== null)
  const pourcent = computed(() => Math.round((props.avancement ?? 0) * 100))

  function confirm() {
    // la boite reste ouverte pendant l'encodage : c'est elle qui porte la progression
    if (!occupe.value) props.onConfirm()
  }
  /** Fermer, c'est ABANDONNER quand l'encodage tourne. */
  function ferme() {
    if (occupe.value) props.onAnnuler()
    open.value = false
  }

  const radio = (nom: string, choix: string, coche: boolean, choisir: () => void, extra: Record<string, unknown> = {}) =>
    h('input', { type: 'radio', name: nom, value: choix, checked: coche, class: 'accent-[var(--ink)]', onChange: choisir, ...extra })

  return () =>
    boite.dessiner(
      { 'aria-label': t('timeline.export') },
      ferme,
      h(
        'form',
        {
          class: 'flex flex-col gap-4',
          onSubmit: (e: Event) => {
            e.preventDefault()
            confirm()
          }
        },
        h('div', { class: 'flex flex-col gap-1' }, h('h2', { class: 'text-sm font-semibold' }, t('timeline.export')), h('p', { class: 'text-xs text-[var(--muted)]' }, t('export.cycleDetail'))),
        h(
          'fieldset',
          { class: 'flex flex-col gap-1', disabled: occupe.value },
          h('legend', { class: 'sr-only' }, t('export.cycleFormat')),
          formats.map((choix, i) =>
            h(
              'label',
              { key: choix, class: 'flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-black/5' },
              radio('format', choix, props.format === choix, () => props.onFormat(choix), { autofocus: i === 0 }),
              h('span', { class: 'flex flex-col' }, t(`export.cycle_${choix}`), h('span', { class: 'text-xs text-[var(--muted)]' }, t(`export.cycle_${choix}_aide`)))
            )
          )
        ),
        // seul le GIF a un alpha a offrir
        cycleAccepteTransparence(props.format)
          ? h(
              'fieldset',
              { key: 'fond', class: 'flex flex-col gap-1', disabled: occupe.value },
              h('legend', { class: 'sr-only' }, t('export.gifBackground')),
              FONDS_GIF.map((choix) =>
                h(
                  'label',
                  { key: choix, class: 'flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-black/5' },
                  radio('fondCycle', choix, props.fond === choix, () => props.onFond(choix)),
                  t(`export.fond_${choix}`)
                )
              )
            )
          : null,
        // l'echec s'affiche ICI : la barre d'export n'est pas a l'ecran dans les Animations
        props.erreur && !occupe.value ? h('p', { key: 'err', class: 'text-xs text-[var(--danger)]', role: 'alert' }, t('export.failed')) : null,
        occupe.value
          ? h(
              'div',
              { key: 'prog', class: 'flex flex-col gap-1.5' },
              // pas de `transition` sur la largeur : elle passerait par le thread principal, sature par l'encodage
              h('div', { class: 'h-1.5 overflow-hidden rounded-full bg-black/10' }, h('div', { class: 'h-full rounded-full bg-[var(--ink)]', style: { width: `${pourcent.value}%` } })),
              h(
                'div',
                { class: 'flex items-center justify-between gap-2' },
                h('p', { class: 'text-xs tabular-nums text-[var(--muted)]' }, `${t('export.cycleProgress')} ${pourcent.value} %`),
                h('button', { type: 'button', class: 'h-7 cursor-pointer rounded-lg px-2 text-xs text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--ink)]', onClick: ferme }, t('dialog.cancel'))
              )
            )
          : h(
              'div',
              { key: 'boutons', class: 'flex justify-end gap-2' },
              h('button', { type: 'button', class: BOUTON_SECONDAIRE, onClick: ferme }, t('dialog.cancel')),
              h('button', { type: 'submit', class: BOUTON_PRINCIPAL }, props.erreur ? t('export.cycleReessayer') : t('export.gifConfirm'))
            )
      )
    )
}
