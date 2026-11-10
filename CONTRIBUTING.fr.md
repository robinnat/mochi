[English](CONTRIBUTING.md) | **Français**

# Contribuer à Mochis

Merci de prendre ce temps. Mochis est un petit projet maintenu sur du temps libre, donc les
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
npx -y pnpm@11.17.0 dev      # http://localhost:5190 (site sur /, app sur /app.html, labo sur /lab.html)
```

La 3D a besoin de WebGL. Si votre navigateur n'en a pas, un court message remplace le Mochi : il n'y a pas de repli en 2D.

## Tester

```bash
npx -y pnpm@11.17.0 test     # vitest
npx -y pnpm@11.17.0 build    # tsc --noEmit && vite build
```

Les deux doivent passer avant d'ouvrir une pull request. `tsc` (lancé par `build`) est le seul
contrôle de types : lancez le build, pas seulement les tests. Ajoutez un test avec chaque correctif
quand c'est possible.

## Style du code

Il n'y a pas de configuration de formateur ni de linter : suivez le code autour.

- TypeScript simple, sans framework : les composants d'interface sont des fonctions construites avec le
  petit moteur de rendu de `src/ui/dom/`, et l'avatar est le Web Component `<mochi-bot>`.
- 2 espaces, apostrophes simples, pas de points-virgules.
- `three`, `src/ui/3d/scene3d.ts` et le reste de la 3D ne sont importés que dynamiquement
  (`await import(...)`), jamais par un `import` statique (`src/site/site.test.ts` le vérifie pour le site).
- Les constantes de `src/bot/` sont des mesures, pas des choix. Ne les arrondissez pas et ne les
  « nettoyez » pas (voir [docs/measurements.md](docs/measurements.md)).
- Tout est en anglais : code, commentaires, identifiants, tests et documentation (`src/english.test.ts` le
  vérifie). Seules les traductions française et chinoise de l'interface de l'app (`src/i18n/locales/`) et les
  fichiers `*.fr.md` sont en français.
- La page `/docs` du site est construite à partir de `README.md` et de `docs/*.md` : modifiez les fichiers
  Markdown, jamais la page (`src/docs/docs-source.test.ts` les garde identiques).
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
