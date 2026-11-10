[English](README.md) | **Français**

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/banner-dark.png">
  <img src="docs/banner.png" alt="Mochis" width="100%">
</picture>

# Mochis

[![Licence : MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [**Démo en ligne**](https://mochi-red-phi.vercel.app)

Les Mochis sont de petits personnages animés pour le web. Un personnage s'appelle un Mochi : une forme douce en 3D avec deux yeux. Il respire, cligne des yeux, montre une humeur et réagit quand on le touche.

On ajoute un Mochi à n'importe quelle page avec une seule balise HTML, `<mochi-bot>`. Elle marche en HTML simple et dans n'importe quel framework (React, Vue, Svelte, Angular...).

- 12 formes et 18 couleurs, ou n'importe quelle couleur hex
- 3 styles, tous en vraie 3D : Soft, Flat et Pixel
- 7 humeurs, et 5 réactions (à une tape, une double tape, un appui long, une secousse, et un coucou à l'arrivée)
- 22 accessoires à combiner, dans les couleurs de votre choix
- thèmes clair et sombre
- exports PNG, SVG, GIF et MP4, depuis l'app

**Site :** https://mochi-red-phi.vercel.app. L'app, un éditeur en ligne pour créer un Mochi et l'exporter, est sur `/app`.

Ce fichier est une traduction pour les lecteurs francophones. La documentation de référence est en anglais : tous les identifiants, attributs et exemples de code sont en anglais.

## Démarrage rapide

> Le paquet npm arrive bientôt. D'ici là, construisez la bibliothèque depuis ce dépôt : voir [Install](docs/getting-started.md#install).

Chargez la bibliothèque, puis écrivez la balise :

```html
<script type="module" src="/mochi/mochis.js"></script>

<mochi-bot shape="star" color="blue" mood="idle" size="200" wave></mochi-bot>
```

## Documentation

La documentation est dans [docs/](docs/README.md), en anglais. Le site montre les mêmes pages sur [/docs](https://mochi-red-phi.vercel.app/docs).

- [Getting started](docs/getting-started.md) : installation, premier Mochi, options, humeurs, réactions, méthodes, événements, accessoires, styles, frameworks.
- [Reference](docs/reference.md) : toutes les options, méthodes, événements et identifiants.
- [How it works](docs/README.md#how-it-works-for-contributors) : architecture et notes de conception pour contribuer.

## Développement

Il faut Node.js 20 ou plus récent.

```bash
npx -y pnpm@11.17.0 install
npx -y pnpm@11.17.0 dev        # http://localhost:5190 (site sur /, app sur /app.html, labo sur /lab.html)
npx -y pnpm@11.17.0 test       # tests (vitest)
npx -y pnpm@11.17.0 build      # vérification des types, puis le site dans dist/
npx -y pnpm@11.17.0 build:lib  # la bibliothèque seule, dans dist-lib/
```

Le code est en TypeScript, sans framework. Le personnage est un Web Component natif. Le site et l'app utilisent un petit moteur de rendu maison (`src/ui/dom/`). Outils : Vite, Tailwind 4 (app seulement) et Three.js (chargé à la demande). [CHANGELOG.md](CHANGELOG.md) a une entrée par version.

## Contribuer

Les signalements de bugs, les idées et les pull requests sont les bienvenus. Lisez d'abord [CONTRIBUTING.fr.md](CONTRIBUTING.fr.md). Toute personne qui participe suit le [Code de conduite](CODE_OF_CONDUCT.fr.md).

## Sécurité

Merci de ne pas signaler un problème de sécurité dans une issue publique. Voir [SECURITY.fr.md](SECURITY.fr.md).

## Licence

MIT, voir [LICENSE](LICENSE).
