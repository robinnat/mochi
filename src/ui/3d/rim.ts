/**
 * Material shading in CAMERA space: everything is computed from the normal as seen from the camera, on the WHOLE
 * volume (face, sides, back) and not in the face texture. So the body is shaded continuously over 360 degrees, and
 * the light stays "top left" for the viewer when the model turns.
 *
 * - soft shading (studio AO): the bottom and the edges darken slightly;
 * - bottom-right glow (backlight / bounce): fresnel limited to a sector towards 4 o'clock;
 * - light top-left glow: same principle towards 10 o'clock, much more discreet;
 * - soft highlight: a wide light spot towards the top left, tinted by the material. No scene light: these are
 *   material effects (a few lines of shader).
 */
import type { Material, WebGLProgramParametersWithUniforms } from './three'

export interface OptionsRim {
  /** soft highlight uniform (0 = none); absent = no highlight */
  highlight?: { value: number }
  /** share of the soft shading (0..1); 0 = none */
  ao?: number
  /**
   * "black eyes" uniform (dark theme): 1 = glows and highlight are not added on the eyes (read from the material's
   * emission mask), which stay plain black; 0 = previous rendering
   */
  eye?: { value: number }
}

export function rim(m: Material, force = 0.55, top = 0, opts: OptionsRim = {}) {
  const prev = m.onBeforeCompile
  const ao = opts.ao ?? 0
  m.onBeforeCompile = (sh: WebGLProgramParametersWithUniforms, r) => {
    prev?.call(m, sh, r)
    if (opts.highlight) sh.uniforms.uHighlight = opts.highlight
    if (opts.eye) sh.uniforms.uEye = opts.eye
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `${opts.highlight ? 'uniform float uHighlight;\n' : ''}${opts.eye ? 'uniform float uEye;\n' : ''}#include <common>`)
      .replace(
        '#include <opaque_fragment>',
        `{
  vec3 nL = normalize(normal);
  float edge = 1.0 - clamp(nL.z, 0.0, 1.0);
  vec2 dir = normalize(nL.xy + vec2(1e-4));
  vec3 tint = mix(diffuseColor.rgb, vec3(1.0), 0.42) * 1.15;
  // soft shading: the bottom and the edges darken, in the body's tint
  float bottom = smoothstep(0.05, 0.95, -nL.y);
  ${opts.eye ? 'float eyeBlack = 1.0 - uEye * texture2D( emissiveMap, vEmissiveMapUv ).r;' : 'float eyeBlack = 1.0;'}
  outgoingLight *= 1.0 - ${ao.toFixed(2)} * (0.26 * bottom + 0.16 * pow(edge, 1.4));
  // bottom-right glow (towards 4 o'clock), fading towards the top and the left
  float sect = smoothstep(-0.1, 0.85, dot(dir, normalize(vec2(0.72, -0.69))));
  float width = mix(3.4, 1.7, sect);
  float glow = pow(edge, width) * sect;
  outgoingLight += tint * glow * ${force.toFixed(2)} * eyeBlack;
  // light top-left glow (towards 10 o'clock), much more discreet and thinner
  float sectH = smoothstep(0.05, 0.9, dot(dir, normalize(vec2(-0.71, 0.70))));
  float glowTop = pow(edge, 2.6) * sectH;
  outgoingLight += tint * glowTop * ${top.toFixed(2)} * eyeBlack;
  ${
    opts.highlight
      ? `// soft highlight: a wide spot towards the top left
  float hl = smoothstep(0.72, 0.99, dot(nL, normalize(vec3(-0.5, 0.62, 0.6))));
  outgoingLight += tint * hl * 0.22 * uHighlight * eyeBlack;`
      : ''
  }
}
#include <opaque_fragment>`
      )
  }
  m.customProgramCacheKey = () => `rim${force}-${top}-${ao}-${opts.highlight ? 'r' : ''}${opts.eye ? 'o' : ''}`
}
