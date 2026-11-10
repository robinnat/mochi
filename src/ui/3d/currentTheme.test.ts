import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The page-wide theme: `auto` by default, which follows the device (`prefers-color-scheme`). The device is read when
 * the module loads, so each test loads a fresh copy with its own fake `matchMedia`.
 */
function fakeDevice(dark: boolean) {
  let listener: (() => void) | null = null
  const query = {
    matches: dark,
    addEventListener: (_: string, f: () => void) => (listener = f)
  }
  vi.stubGlobal('matchMedia', () => query)
  return {
    switchTo(next: boolean) {
      query.matches = next
      listener?.()
    }
  }
}

async function load() {
  vi.resetModules()
  return import('./currentTheme')
}

afterEach(() => vi.unstubAllGlobals())

describe('theme of a Mochi without its own theme', () => {
  it('is auto by default and follows a dark device', async () => {
    fakeDevice(true)
    const m = await load()
    expect(m.currentTheme.value).toBe('auto')
    expect(m.resolveTheme(undefined)).toBe('dark')
  })

  it('follows a light device', async () => {
    fakeDevice(false)
    const m = await load()
    expect(m.resolveTheme(undefined)).toBe('light')
  })

  it('changes when the visitor switches the device to dark mode', async () => {
    const device = fakeDevice(false)
    const m = await load()
    device.switchTo(true)
    expect(m.resolveTheme(undefined)).toBe('dark')
  })

  it('a page setting wins over the device, and the own theme wins over both', async () => {
    fakeDevice(true)
    const m = await load()
    m.currentTheme.value = 'light'
    expect(m.resolveTheme(undefined)).toBe('light')
    expect(m.resolveTheme('dark')).toBe('dark')
    // an unknown own theme is ignored, like an absent one
    expect(m.resolveTheme('auto')).toBe('light')
  })

  it('without matchMedia (no browser), auto gives light', async () => {
    vi.stubGlobal('matchMedia', undefined)
    const m = await load()
    expect(m.resolveTheme(undefined)).toBe('light')
  })
})
