import { describe, expect, it } from 'vitest'
import { rim, SOFT_LIGHT_FROM, SOFT_LIGHT_GAIN } from './rim'
import type { Material, WebGLProgramParametersWithUniforms } from './three'

/** Runs the `onBeforeCompile` hook that `rim` installs on a fake shader, returns the fragment shader and uniforms. */
function compile(opts: Parameters<typeof rim>[3]) {
  const m = {} as Material
  rim(m, 0.5, 0.22, opts)
  const sh = {
    uniforms: {} as Record<string, unknown>,
    fragmentShader: '#include <common>\nvoid main() {\n#include <opaque_fragment>\n}'
  } as unknown as WebGLProgramParametersWithUniforms
  m.onBeforeCompile(sh, {} as never)
  return { m, sh }
}

describe('rim: soft top-left light of the Soft style (11/11/2026)', () => {
  it('adds the soft light when the body passes its uniform (shading on)', () => {
    const u = { value: 1 }
    const { sh } = compile({ ao: 1, softLight: u })
    expect(sh.fragmentShader).toContain('uniform float uSoftLight;')
    expect(sh.fragmentShader).toContain('uSoftLight * eyeBlack')
    expect(sh.uniforms.uSoftLight).toBe(u)
  })

  it('is a long gradient with no edge, not the old shine spot (0.72..0.99)', () => {
    expect(SOFT_LIGHT_FROM).toBeLessThanOrEqual(0.5)
    expect(SOFT_LIGHT_GAIN).toBeGreaterThan(0)
    const { sh } = compile({ softLight: { value: 1 } })
    expect(sh.fragmentShader).toContain(`smoothstep(${SOFT_LIGHT_FROM.toFixed(2)}, 1.0,`)
    expect(sh.fragmentShader).not.toContain('smoothstep(0.72, 0.99')
  })

  it('respects black eyes: the light is multiplied by the eye mask', () => {
    const { sh } = compile({ softLight: { value: 1 }, eye: { value: 1 } })
    expect(sh.fragmentShader).toMatch(/hl \* [\d.]+ \* uSoftLight \* eyeBlack/)
    expect(sh.fragmentShader).toContain('float eyeBlack = 1.0 - uEye')
  })

  it('without the uniform there is no soft light, and the program cache key differs', () => {
    const off = compile({ ao: 1 })
    const on = compile({ ao: 1, softLight: { value: 1 } })
    expect(off.sh.fragmentShader).not.toContain('uSoftLight')
    expect(off.m.customProgramCacheKey()).not.toBe(on.m.customProgramCacheKey())
  })
})
