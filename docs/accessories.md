# Accessories (how they are built)

For the list of ids, see the [reference](reference.md#accessories). This page explains how accessories work inside the code.

- `src/bot/slots.ts`: the catalog (ids, names, colors). No geometry.
- `src/ui/3d/accessories3d.ts`: the 3D volumes.
- `src/ui/3d/anchors.ts`: where each piece sits, found by casting rays on the body of the current frame.

## Slots

One accessory per slot at most, and all slots stack:

| Slot | Where | Examples |
| --- | --- | --- |
| `head` | on top of the head (never lower than 28 % of the height) | cap, top hat, crown |
| `eyes` | on the line of the eyes | round glasses, sunglasses, monocle |
| `neck` | the "neck", around 76 % of the height, with tilted rings | bow tie, scarf, pearl necklace |
| `back` | sides and back | backpack, cape |

A fifth slot, `face`, still exists in the code but holds no accessory today: all its pieces were removed.

Inside the code, the 3D object of `scene3d.ts` takes the selection (on a page, use the `accessories` option of `<mochi-bot>` instead):

```ts
mochi.setAccessories({ head: 'cap', eyes: 'sunglasses', neck: 'bowtie' })
// or with your own colors: { head: { id: 'cap', c1: '#e8505b' } }
```

Rule for every accessory: a very simple shape, ONE color (`c1`), TWO at most (`c2`, for example a flower: petals and center). No stripes, gems or patterns.

## Light and styles

In the Soft style, accessories get the same light as the body (`rim.ts`). Flat and Pixel reuse the body material. The soft shadows they cast on the body are painted in the body texture.

## Removed accessories

Removed pieces stay in `REMOVED` (`src/bot/slots.ts`) with their 3D builders, so one can come back by copying it into the catalog. They no longer show anywhere.
