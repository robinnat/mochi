import type { MoodId, ReactionId } from '@/bot/humeurs'

/**
 * Noms anglais acceptes par `mood` (alias de `moodDe` dans `src/bot/humeurs.ts`, non exportes) : recopies ici pour la
 * page docs, et `exemples.test.ts` verifie que chacun est bien resolu par `moodDe` vers la bonne humeur.
 */
export const ALIAS_HUMEURS: Record<MoodId, string[]> = {
  repos: ['idle'],
  reflechit: ['thinking'],
  travaille: ['working'],
  attend: ['waiting'],
  termine: ['done'],
  bloque: ['blocked'],
  dort: ['sleep', 'sleeping']
}

/** Ce que fait chaque reaction, et ce qui la declenche toute seule. */
export const REACTIONS_DOC: Record<ReactionId, string> = {
  sursaut: 'startle (tap)',
  rigole: 'laugh (double tap)',
  rougit: 'blush, held (long press)',
  etourdi: 'dizzy (shake or fast spin)',
  coucou: 'hello (coucou prop)'
}
