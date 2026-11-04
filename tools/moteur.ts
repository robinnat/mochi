/**
 * Point d'entree du moteur seul (sans Vue), pour l'utiliser dans une autre page :
 *
 *   npx esbuild@0.24.0 tools/moteur.ts --bundle --format=esm --minify --alias:vue=./tools/vue-stub.ts --outfile=mochi-engine.js
 *
 * Le fichier produit garde la licence MIT : recopier l'en-tete de LICENSE en tete du fichier.
 */
export { BotEngine } from '../src/bot/engine'
export { COLOR_BY_ID, SHAPE_BY_ID, mixHex } from '../src/bot/skins'
export { EXPRESSION_BY_ID } from '../src/bot/expressions'
export { DEMI_VIEWBOX, RAYON } from '../src/bot/repere'
export { teintes3d } from '../src/ui/rendu'
export {
  ACTIVITES,
  ACTIVITE_BY_ID,
  GESTE_NEUTRE,
  GESTES_REPOS,
  REBOND_DUREE,
  composer,
  gesteEchec,
  gesteRepos,
  gesteSommeil,
  personnalite,
  rebond,
  tempsActivite,
  zSommeil
} from '../src/bot/gestes'
export {
  ACCESSOIRES,
  ACCESSOIRE_BY_ID,
  ACCESSOIRE_DE_METIER,
  TEINTES_OBJETS,
  accessoireDuMetier,
  ancreDuCorps
} from '../src/bot/accessoires'
