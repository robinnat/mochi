[English](CONTRIBUTING.md) | **Français**

# Contribuer à Mochi World

Merci de prendre ce temps. Mochi World est un petit projet maintenu sur du temps libre, donc les
relectures peuvent prendre un moment. Les pull requests petites et ciblées sont les plus faciles à relire.

## Avant de commencer

- Pour un bug, ouvrez une issue avec le modèle de bug (étapes, navigateur, style de rendu).
- Pour une nouvelle fonctionnalité ou un changement plus important, ouvrez d'abord une demande de
  fonctionnalité, pour qu'on se mette d'accord sur l'idée avant que vous écriviez le code.
- Pour un problème de sécurité, n'ouvrez pas d'issue publique : voir [SECURITY.fr.md](SECURITY.fr.md).

## Installation

Il vous faut Node.js 24 (la version utilisée par la CI) et Git. Le projet utilise pnpm 11.17.0, lancé
avec `npx` : inutile d'installer pnpm globalement.

```bash
git clone https://github.com/robinnat/mochi.git
cd mochi
npx -y pnpm@11.17.0 install
```

## Lancer

```bash
npx -y pnpm@11.17.0 dev      # http://localhost:5190 (site sur /, app sur /app.html, labo sur /labo.html)
```

La 3D a besoin de WebGL. Si votre navigateur n'en a pas, l'avatar revient à son dessin SVG.

## Tester

```bash
npx -y pnpm@11.17.0 test     # vitest
npx -y pnpm@11.17.0 build    # vue-tsc --noEmit && vite build
```

Les deux doivent passer avant d'ouvrir une pull request. `vue-tsc` (lancé par `build`) est le seul
contrôle de types : lancez le build, pas seulement les tests. Ajoutez un test avec chaque correctif
quand c'est possible.

## Style du code

Il n'y a pas de configuration de formateur ni de linter : suivez le code autour.

- TypeScript et composants Vue 3 en un seul fichier avec `<script setup lang="ts">`.
- 2 espaces, apostrophes simples, pas de points-virgules.
- `three`, `src/ui/trois/scene3d.ts` et le reste de la 3D ne sont importés que dynamiquement
  (`await import(...)`), jamais par un `import` statique (`src/site/site.test.ts` le vérifie pour le site).
- Les constantes de `src/bot/` sont des mesures, pas des choix. Ne les arrondissez pas et ne les
  « nettoyez » pas (voir [docs/measurements.md](docs/measurements.md)).
- Les commentaires du code, les identifiants (`etoile`, `rendu`) et la plupart des fichiers de `docs/`
  sont en français. Vous pouvez écrire les nouveaux commentaires et la nouvelle documentation en anglais.
- Gardez l'en-tête MIT de [LICENSE](LICENSE) tel quel, avec ses deux lignes de copyright.

## Pull requests

- Une pull request par sujet. Ne mélangez pas un correctif, une réorganisation du code et une
  nouvelle fonctionnalité.
- Partez de `main` et ouvrez la pull request vers `main`.
- Décrivez ce qui change et pourquoi, et comment vous l'avez testé. Ajoutez une capture ou un court
  extrait vidéo pour tout ce qui est visuel.
- Ajoutez une ligne à [CHANGELOG.md](CHANGELOG.md) sous `[Unreleased]` quand les utilisateurs
  remarqueront le changement.
- La CI doit être verte. `main` est protégée : chaque changement passe par une pull request, et le
  contrôle `verifie` (installation, build, tests) doit réussir avant de pouvoir merger.

## Licence

En contribuant, vous acceptez que votre contribution soit publiée sous la [licence MIT](LICENSE) de
ce projet.
