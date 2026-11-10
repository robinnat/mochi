**English** | [Français](README.fr.md)

# Mochis

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [**Live demo**](https://mochi-red-phi.vercel.app)

Mochis are small animated characters for the web. A Mochi is one soft 3D shape with two eyes. It breathes, blinks, has seven moods and reacts when you touch it. You add one to any page with a single HTML tag, `<mochi-bot>`, in plain HTML or in any framework.

- 12 shapes, 18 colors (or any hex color)
- 3 styles, all in real 3D: Soft, Flat and Pixel
- 7 moods and 5 reactions (tap, double tap, long press, shake, hello)
- 22 accessories you can stack, in the colors you choose
- light and dark themes
- exports from the app: PNG, SVG, GIF and MP4

**Website and app:** https://mochi-red-phi.vercel.app (the app is at `/app`).

## Quick start

> The npm package is coming soon. Until then, build the library from this repository: see [Install](docs/getting-started.md#install).

```html live
<script type="module" src="/mochi/mochis.js"></script>

<mochi-bot shape="star" color="blue" mood="idle" size="200" wave></mochi-bot>
```

## Documentation

The documentation lives in [docs/](docs/README.md). The website shows the same pages at [/docs](https://mochi-red-phi.vercel.app/docs).

- [Getting started](docs/getting-started.md): install, your first Mochi, shapes, styles, moods, accessories, frameworks.
- [Reference](docs/reference.md): every option, method, event and id.
- [How it works](docs/README.md#how-it-works-for-contributors): architecture and design notes for contributors.

## Development

You need Node.js 20 or later.

```bash
npx -y pnpm@11.17.0 install
npx -y pnpm@11.17.0 dev        # http://localhost:5190 (site at /, app at /app.html, lab at /lab.html)
npx -y pnpm@11.17.0 test       # tests (vitest)
npx -y pnpm@11.17.0 build      # type check, then the website in dist/
npx -y pnpm@11.17.0 build:lib  # the library alone, in dist-lib/
```

TypeScript with no framework: the character is a native web component, and the website and app use a small in-house renderer (`src/ui/dom/`). Vite, Tailwind 4 (app only), Three.js (loaded on demand). [CHANGELOG.md](CHANGELOG.md) has one entry per version.

## Contributing

Bug reports, ideas and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Please do not report security problems in a public issue. See [SECURITY.md](SECURITY.md).

## License

MIT, see [LICENSE](LICENSE).
