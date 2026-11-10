import type { MoodId, ReactionId } from 'mochi-world/catalogue'

/**
 * Noms anglais acceptes par `mood` (alias de `resolveMood` dans `src/bot/moods.ts`, non exportes) : recopies ici pour la
 * page docs, et `exemples.test.ts` verifie que chacun est bien resolu par `resolveMood` vers la bonne humeur.
 */
export const MOOD_ALIASES: Record<MoodId, string[]> = {
  idle: ['idle'],
  thinking: ['thinking'],
  working: ['working'],
  waiting: ['waiting'],
  done: ['done'],
  blocked: ['blocked'],
  asleep: ['sleep', 'sleeping']
}

/** Ce que fait chaque reaction, et ce qui la declenche toute seule. */
export const REACTIONS_DOC: Record<ReactionId, string> = {
  startle: 'startle (tap)',
  laugh: 'laugh (double tap)',
  blush: 'blush, held (long press)',
  dizzy: 'dizzy (shake or fast spin)',
  wave: 'hello (coucou prop)'
}
