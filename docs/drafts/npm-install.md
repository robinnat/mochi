# Draft: npm install (applied)

**Applied for 0.2.1 (2026-11-11)**: the published docs now carry this text, and `docs/drafts/PUBLISHED` exists. This
file is kept as the record of what was moved.

This page is NOT part of the documentation: `/docs` only reads `docs/*.md`, and nothing links here. It holds the
npm version of the install instructions, ready for the day the `mochiz-world` package is published on npm.

**On publication day:**

1. Publish the package (`npm publish`, from a clean `main`, after `pnpm test` and `pnpm build:lib`).
2. Create the empty file `docs/drafts/PUBLISHED`. Until it exists, `src/docs/docs-source.test.ts` fails if the
   published docs mention `npm install mochiz-world` or the jsDelivr link.
3. Replace the `## Install` section of `docs/getting-started.md` with the one below, and the quick starts of
   `README.md` and `README.fr.md` with theirs. Switch the examples to `import 'mochiz-world'` and the CDN script tag.
4. Update the docs tests that check the install paths (search `PUBLISHED` in `docs-source.test.ts`).

---

<!-- getting-started.md -->

## Install

### With npm (recommended)

You need [Node.js](https://nodejs.org) 22.12 or later. Install Mochiz and Three.js (the 3D library Mochiz draws with):

```bash
npm install mochiz-world three
```

Three.js is a peer dependency: your project installs it once, and Mochiz uses that copy. Then import the library once, from a file of your app (here `src/main.js`). Importing it declares the `<mochi-bot>` tag:

```js
import 'mochiz-world'
```

That is all. TypeScript types come with the package: `document.querySelector('mochi-bot')` is typed, and so are the catalogs. If your `tsconfig.json` sets `skipLibCheck` to `false`, also install the Three.js types: `npm install -D @types/three`. The 3D part loads by itself, only when a Mochi is shown.

To build a picker without loading the tag, import the catalogs alone:

```js
import { SHAPES, COLORS } from 'mochiz-world/catalog'
```

### Plain HTML, without a build tool

Load the standalone build (Three.js included) from a CDN, with a script tag:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/mochiz-world@0.2.0/dist-lib/standalone/mochiz.js"></script>
```

### Without npm: build it from the repository

You can also build the library yourself and copy it into your project:

```bash
git clone https://github.com/robinnat/mochiz.git
cd mochiz
npx pnpm@11.17.0 install
npx pnpm@11.17.0 build:lib
```

This writes the library to `dist-lib/`. Copy the `dist-lib/standalone` folder (Three.js included), and keep its files together: the 3D part is a separate file, loaded only when a Mochi is shown.

- Plain HTML: copy it next to your page, under the name `mochiz` (`cp -r dist-lib/standalone ../my-site/mochiz`), then load it with `<script type="module" src="/mochiz/mochiz.js"></script>`.
- An app with a bundler (Vite, webpack...): copy it into your source code (`cp -r dist-lib/standalone ../my-app/src/vendor/mochiz`), then write `import './vendor/mochiz/mochiz.js'` in a file of `src/`. Do not put it in `public/`: a bundler serves that folder as is and cannot import JavaScript from it.

The built files keep the MIT license notice: ship it with your app.

The examples below load the library from the CDN in plain HTML and with `import 'mochiz-world'` in JavaScript. Use the way that matches your project.


---

<!-- README.md -->

## Quick start

Install it with npm:

```bash
npm install mochiz-world three
```

Import it once (`import 'mochiz-world'`), then write the tag. In a plain HTML page, load it from a CDN instead:

```html live
<script type="module" src="https://cdn.jsdelivr.net/npm/mochiz-world@0.2.0/dist-lib/standalone/mochiz.js"></script>

<mochi-bot shape="star" color="blue" mood="idle" size="200" wave></mochi-bot>
```

Three.js is a peer dependency, and TypeScript types are included. Other ways (building from this repository): see [Install](docs/getting-started.md#install).


---

<!-- README.fr.md -->

## Démarrage rapide

Installez-la avec npm :

```bash
npm install mochiz-world three
```

Importez-la une fois (`import 'mochiz-world'`), puis écrivez la balise. Dans une page HTML simple, chargez-la plutôt depuis un CDN :

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/mochiz-world@0.2.0/dist-lib/standalone/mochiz.js"></script>

<mochi-bot shape="star" color="blue" mood="idle" size="200" wave></mochi-bot>
```

Three.js est une dépendance « peer » (votre projet l'installe une fois), et les types TypeScript sont inclus. Autres façons (construire depuis ce dépôt) : voir [Install](docs/getting-started.md#install).

