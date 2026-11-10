// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'

/**
 * Regression (v13): tags already in the page (the docs' live examples) are upgraded while the module is still being
 * evaluated. Everything they read at mount must already be declared (the shared cadence was not: "cannot access
 * before initialization", no Mochi on /docs).
 */
describe('<mochi-bot> already in the page when the module loads', () => {
  it('upgrades and draws its svg without an error', async () => {
    document.body.innerHTML = '<mochi-bot size="80" frozen-at="1.2"></mochi-bot>'
    const errors: unknown[] = []
    const onError = (e: ErrorEvent) => errors.push(e.error ?? e.message)
    window.addEventListener('error', onError)
    await import('./mochi-bot')
    await new Promise((r) => setTimeout(r, 0))
    window.removeEventListener('error', onError)
    expect(errors).toEqual([])
    expect(document.querySelector('mochi-bot svg')).not.toBeNull()
  })
})
