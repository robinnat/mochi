/**
 * Ombrage de matiere en repere de la CAMERA : tout est calcule a partir de la normale exprimee depuis la
 * camera, sur TOUT le volume (face, flancs, dos) et pas dans la texture de visage. Le corps
 * est donc ombre de facon continue sur 360 degres, et la lumiere reste « en haut a gauche »
 * pour le spectateur quand le modele tourne.
 *
 * - ombrage doux (AO de studio) : le bas et les bords s'assombrissent legerement ;
 * - lueur bas-droite (contre-jour / rebond) : fresnel limite a un secteur vers 4 h ;
 * - lueur legere haut-gauche : meme principe vers 10 h, nettement plus discrete ;
 * - reflet doux : large tache lumineuse vers le haut a gauche, teintee de la matiere.
 * Aucune lumiere de scene : ce sont des effets de matiere (quelques lignes de shader).
 */
import type { Material, WebGLProgramParametersWithUniforms } from 'three'

export interface OptionsRim {
  /** uniform du reflet doux (0 = sans) ; absent = pas de reflet */
  highlight?: { value: number }
  /** part de l'ombrage doux (0..1) ; 0 = aucun */
  ao?: number
  /**
   * uniform « yeux noirs » (theme sombre) : 1 = les lueurs et le reflet ne s'ajoutent pas sur les yeux
   * (lus dans le masque d'emission du materiau), qui restent d'un noir franc ; 0 = rendu d'avant
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
      .replace('#include <common>', `${opts.highlight ? 'uniform float uReflet;\n' : ''}${opts.eye ? 'uniform float uOeil;\n' : ''}#include <common>`)
      .replace(
        '#include <opaque_fragment>',
        `{
  vec3 nL = normalize(normal);
  float edge = 1.0 - clamp(nL.z, 0.0, 1.0);
  vec2 dir = normalize(nL.xy + vec2(1e-4));
  vec3 tint = mix(diffuseColor.rgb, vec3(1.0), 0.42) * 1.15;
  // shading soft : le bas et les bords s'assombrissent, within la tint du body
  float bas = smoothstep(0.05, 0.95, -nL.y);
  ${opts.eye ? 'float noirOeil = 1.0 - uOeil * texture2D( emissiveMap, vEmissiveMapUv ).r;' : 'float noirOeil = 1.0;'}
  outgoingLight *= 1.0 - ${ao.toFixed(2)} * (0.26 * bas + 0.16 * pow(edge, 1.4));
  // lueur bas-droite (to 4 h), qui s'estompe to le top et to la left
  float sect = smoothstep(-0.1, 0.85, dot(dir, normalize(vec2(0.72, -0.69))));
  float width = mix(3.4, 1.7, sect);
  float lueur = pow(edge, width) * sect;
  outgoingLight += tint * lueur * ${force.toFixed(2)} * noirOeil;
  // lueur legere haut-gauche (to 10 h), nettement most discrete et most fine
  float sectH = smoothstep(0.05, 0.9, dot(dir, normalize(vec2(-0.71, 0.70))));
  float lueurH = pow(edge, 2.6) * sectH;
  outgoingLight += tint * lueurH * ${top.toFixed(2)} * noirOeil;
  ${
    opts.highlight
      ? `// highlight soft : large tache to le top a left
  float hl = smoothstep(0.72, 0.99, dot(nL, normalize(vec3(-0.5, 0.62, 0.6))));
  outgoingLight += tint * hl * 0.22 * uHighlight * noirOeil;`
      : ''
  }
}
#include <opaque_fragment>`
      )
  }
  m.customProgramCacheKey = () => `rim${force}-${top}-${ao}-${opts.highlight ? 'r' : ''}${opts.eye ? 'o' : ''}`
}
