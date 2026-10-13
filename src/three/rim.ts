// Soft rim light so characters keep a readable silhouette on small screens.

import * as THREE from 'three';

export function addRim<T extends THREE.MeshStandardMaterial>(
  mat: T,
  color: THREE.ColorRepresentation = '#fff4e0',
  strength = 0.35,
  power = 2.6,
): T {
  const uniforms = {
    rimColor: { value: new THREE.Color(color) },
    rimStrength: { value: strength },
    rimPower: { value: power },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;\nuniform float rimPower;',
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float rimF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), rimPower);
          totalEmissiveRadiance += rimColor * rimF * rimStrength;
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'rim';
  mat.userData.rim = uniforms;
  return mat;
}
