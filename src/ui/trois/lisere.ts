/**
 * Liseré lumineux du bas a droite : une petite lueur de contre-jour / rebond le long du bord
 * inferieur droit du corps, comme sur les personnages 3D de reference. C'est un effet de MATIERE
 * (quelques lignes de shader, cout negligeable), pas une lumiere de la scene.
 *
 * Il est calcule dans le repere de la CAMERA : la lueur reste donc en bas a droite quand le
 * modele tourne. Fresnel (bord vu de profil) limite a un secteur, fin dans le secteur le plus
 * lumineux et un peu plus large vers ses lisieres, teinte de la couleur du materiau en plus clair.
 */
import type { Material, WebGLProgramParametersWithUniforms } from 'three'

export function lisere(m: Material, force = 0.55, haut = 0) {
  const prev = m.onBeforeCompile
  m.onBeforeCompile = (sh: WebGLProgramParametersWithUniforms, r) => {
    prev?.call(m, sh, r)
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      `{
  vec3 nL = normalize(normal);
  float bord = 1.0 - clamp(nL.z, 0.0, 1.0);
  vec2 dir = normalize(nL.xy + vec2(1e-4));
  // secteur bas-droite (vers 4 heures), qui s'estompe vers le haut et vers la gauche
  float sect = smoothstep(-0.1, 0.85, dot(dir, normalize(vec2(0.72, -0.69))));
  float largeur = mix(3.4, 1.7, sect);
  float lueur = pow(bord, largeur) * sect;
  vec3 teinte = mix(diffuseColor.rgb, vec3(1.0), 0.42) * 1.15;
  outgoingLight += teinte * lueur * ${force.toFixed(2)};
  // lueur legere en haut a gauche (vers 10 h), nettement plus discrete, bien plus fine que le reflet doux
  float sectH = smoothstep(0.05, 0.9, dot(dir, normalize(vec2(-0.71, 0.70))));
  float lueurH = pow(bord, 2.6) * sectH;
  outgoingLight += teinte * lueurH * ${haut.toFixed(2)};
}
#include <opaque_fragment>`
    )
  }
  m.customProgramCacheKey = () => `lisere${force}-${haut}`
}
