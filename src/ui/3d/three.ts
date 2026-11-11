/**
 * The only door to Three.js in the code: every 3D module imports from here, never from `'three'`.
 *
 * Why: the `three` package entry is one big prebuilt file whose classes are not tree-shaken (loaders, animation,
 * audio, WebXR... all ended up in the bundle, 744 kB). Importing each class from its own source file keeps only what
 * Mochiz draws with. A single entry also keeps a single copy of each class (`instanceof` stays true): mixing this
 * file and `'three'` would load Three.js twice, so the build configs also point `'three'` here (the Three.js add-ons
 * we use, such as `BufferGeometryUtils`, import `'three'`). `src/ui/3d/three.test.ts` checks these rules.
 */

export { WebGLRenderer } from 'three/src/renderers/WebGLRenderer.js'
export { Scene } from 'three/src/scenes/Scene.js'
export { OrthographicCamera } from 'three/src/cameras/OrthographicCamera.js'
export { Object3D } from 'three/src/core/Object3D.js'
export { BufferGeometry } from 'three/src/core/BufferGeometry.js'
export { BufferAttribute, Float32BufferAttribute } from 'three/src/core/BufferAttribute.js'
export { InstancedBufferAttribute } from 'three/src/core/InstancedBufferAttribute.js'
export { InterleavedBuffer } from 'three/src/core/InterleavedBuffer.js'
export { InterleavedBufferAttribute } from 'three/src/core/InterleavedBufferAttribute.js'
export { Raycaster } from 'three/src/core/Raycaster.js'
export { Group } from 'three/src/objects/Group.js'
export { Mesh } from 'three/src/objects/Mesh.js'
export { Light } from 'three/src/lights/Light.js'
export { AmbientLight } from 'three/src/lights/AmbientLight.js'
export { DirectionalLight } from 'three/src/lights/DirectionalLight.js'
export { HemisphereLight } from 'three/src/lights/HemisphereLight.js'
export { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial.js'
export { MeshStandardMaterial } from 'three/src/materials/MeshStandardMaterial.js'
export { MeshToonMaterial } from 'three/src/materials/MeshToonMaterial.js'
export { CanvasTexture } from 'three/src/textures/CanvasTexture.js'
export { DataTexture } from 'three/src/textures/DataTexture.js'
export { Box3 } from 'three/src/math/Box3.js'
export { Color } from 'three/src/math/Color.js'
export { Matrix4 } from 'three/src/math/Matrix4.js'
export { Quaternion } from 'three/src/math/Quaternion.js'
export { Triangle } from 'three/src/math/Triangle.js'
export { Vector2 } from 'three/src/math/Vector2.js'
export { Vector3 } from 'three/src/math/Vector3.js'
export * as MathUtils from 'three/src/math/MathUtils.js'
export { Shape } from 'three/src/extras/core/Shape.js'
export { CatmullRomCurve3 } from 'three/src/extras/curves/CatmullRomCurve3.js'
export { CapsuleGeometry } from 'three/src/geometries/CapsuleGeometry.js'
export { ConeGeometry } from 'three/src/geometries/ConeGeometry.js'
export { CylinderGeometry } from 'three/src/geometries/CylinderGeometry.js'
export { ExtrudeGeometry } from 'three/src/geometries/ExtrudeGeometry.js'
export { LatheGeometry } from 'three/src/geometries/LatheGeometry.js'
export { ShapeGeometry } from 'three/src/geometries/ShapeGeometry.js'
export { SphereGeometry } from 'three/src/geometries/SphereGeometry.js'
export { TorusGeometry } from 'three/src/geometries/TorusGeometry.js'
export { TubeGeometry } from 'three/src/geometries/TubeGeometry.js'
export {
  BackSide,
  DoubleSide,
  LinearFilter,
  NearestFilter,
  RedFormat,
  SRGBColorSpace,
  TriangleFanDrawMode,
  TriangleStripDrawMode,
  TrianglesDrawMode,
  UnsignedByteType
} from 'three/src/constants.js'
export type { Material } from 'three/src/materials/Material.js'
export type { WebGLProgramParametersWithUniforms } from 'three/src/renderers/webgl/WebGLPrograms.js'
