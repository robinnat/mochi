/**
 * Side of a sheet cell that fits the screen width: `?s=` forces it, otherwise `initial`, reduced on a phone so every
 * column fits (the sheet no longer overflows on the right).
 */
export function sizeCell(initial: number, columns: number, header: number, gap = 8): number {
  const forced = Number(new URLSearchParams(location.search).get('s'))
  if (forced) return forced
  const place = window.innerWidth - 32 - header - gap * columns
  return Math.max(48, Math.min(initial, Math.floor(place / columns)))
}
