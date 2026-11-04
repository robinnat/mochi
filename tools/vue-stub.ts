// Remplace `vue` dans le paquet du moteur seul (tools/moteur.ts) : rendu.ts n'en utilise que `ref`.
export const ref = <T>(value: T) => ({ value })
