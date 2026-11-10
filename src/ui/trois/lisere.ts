/**
 * Ombrage de matiere en repere de la VUE : tout est calcule a partir de la normale vue de la
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

export interface OptionsLisere {
  /** uniform du reflet doux (0 = sans) ; absent = pas de reflet */
  reflet?: { value: number }
  /** part de l'ombrage doux (0..1) ; 0 = aucun */
  ao?: number
  /**
   * uniform « yeux noirs » (theme sombre) : 1 = les lueurs et le reflet ne s'ajoutent pas sur les yeux
   * (lus dans le masque d'emission du materiau), qui restent d'un noir franc ; 0 = rendu d'avant
   */
  oeil?: { value: number }
}

export function lisere(m: Material, force = 0.55, haut = 0, opts: OptionsLisere = {}) {
  const prev = m.onBeforeCompile
  const ao = opts.ao ?? 0
  m.onBeforeCompile = (sh: WebGLProgramParametersWithUniforms, r) => {
    prev?.call(m, sh, r)
    if (opts.reflet) sh.uniforms.uReflet = opts.reflet
    if (opts.oeil) sh.uniforms.uOeil = opts.oeil
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `${opts.reflet ? 'uniform float uReflet;\n' : ''}${opts.oeil ? 'uniform float uOeil;\n' : ''}#include <common>`)
      .replace(
        '#include <opaque_fragment>',
        `{
  vec3 nL = normalize(normal);
  float bord = 1.0 - clamp(nL.z, 0.0, 1.0);
  vec2 dir = normalize(nL.xy + vec2(1e-4));
  vec3 teinte = mix(diffuseColor.rgb, vec3(1.0), 0.42) * 1.15;
  // ombrage doux : le bas et les bords s'assombrissent, dans la teinte du corps
  float bas = smoothstep(0.05, 0.95, -nL.y);
  ${opts.oeil ? 'float noirOeil = 1.0 - uOeil * texture2D( emissiveMap, vEmissiveMapUv ).r;' : 'float noirOeil = 1.0;'}
  outgoingLight *= 1.0 - ${ao.toFixed(2)} * (0.26 * bas + 0.16 * pow(bord, 1.4));
  // lueur bas-droite (vers 4 h), qui s'estompe vers le haut et vers la gauche
  float sect = smoothstep(-0.1, 0.85, dot(dir, normalize(vec2(0.72, -0.69))));
  float largeur = mix(3.4, 1.7, sect);
  float lueur = pow(bord, largeur) * sect;
  outgoingLight += teinte * lueur * ${force.toFixed(2)} * noirOeil;
  // lueur legere haut-gauche (vers 10 h), nettement plus discrete et plus fine
  float sectH = smoothstep(0.05, 0.9, dot(dir, normalize(vec2(-0.71, 0.70))));
  float lueurH = pow(bord, 2.6) * sectH;
  outgoingLight += teinte * lueurH * ${haut.toFixed(2)} * noirOeil;
  ${
    opts.reflet
      ? `// reflet doux : large tache vers le haut a gauche
  float hl = smoothstep(0.72, 0.99, dot(nL, normalize(vec3(-0.5, 0.62, 0.6))));
  outgoingLight += teinte * hl * 0.22 * uReflet * noirOeil;`
      : ''
  }
}
#include <opaque_fragment>`
      )
  }
  m.customProgramCacheKey = () => `lisere${force}-${haut}-${ao}-${opts.reflet ? 'r' : ''}${opts.oeil ? 'o' : ''}`
}
