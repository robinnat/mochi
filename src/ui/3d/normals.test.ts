import { describe, expect, it } from 'vitest'
import { BufferAttribute, SphereGeometry, TorusGeometry } from './three'
import { smoothNormals, vertexNormals } from './scene3d'

/** The smoothing as it was before v13 (pass over the triangles), kept as the reference. */
function smoothReference(nor: BufferAttribute, index: ArrayLike<number>, passes: number) {
  const n = nor.count
  const acc = new Float32Array(n * 3)
  const A = nor.array as Float32Array
  for (let p = 0; p < passes; p++) {
    acc.fill(0)
    for (let t = 0; t < index.length; t += 3) {
      const a = index[t]!
      const b = index[t + 1]!
      const c = index[t + 2]!
      for (let d = 0; d < 3; d++) {
        acc[a * 3 + d]! += A[b * 3 + d]! + A[c * 3 + d]!
        acc[b * 3 + d]! += A[a * 3 + d]! + A[c * 3 + d]!
        acc[c * 3 + d]! += A[a * 3 + d]! + A[b * 3 + d]!
      }
    }
    for (let i = 0; i < n; i++) {
      const x = A[i * 3]! * 2 + acc[i * 3]!
      const y = A[i * 3 + 1]! * 2 + acc[i * 3 + 1]!
      const z = A[i * 3 + 2]! * 2 + acc[i * 3 + 2]!
      const l = Math.hypot(x, y, z) || 1
      A[i * 3] = x / l
      A[i * 3 + 1] = y / l
      A[i * 3 + 2] = z / l
    }
  }
}

/** A bumpy mesh, so that normals and smoothing really have something to do. */
function bumpy(kind: 'sphere' | 'torus') {
  const g = kind === 'sphere' ? new SphereGeometry(100, 48, 32) : new TorusGeometry(80, 30, 24, 64)
  const p = g.attributes.position!.array as Float32Array
  for (let i = 0; i < p.length; i += 3) {
    const k = 1 + 0.08 * Math.sin(p[i]! * 0.13) * Math.cos(p[i + 1]! * 0.11)
    p[i] = p[i]! * k
    p[i + 1] = p[i + 1]! * k
    p[i + 2] = p[i + 2]! * k
  }
  return g
}

describe('fast normals (v13): same result as before', () => {
  for (const kind of ['sphere', 'torus'] as const) {
    it(`vertexNormals gives exactly Three's computeVertexNormals (${kind})`, () => {
      const a = bumpy(kind)
      const b = bumpy(kind)
      a.computeVertexNormals()
      vertexNormals(b)
      expect(Array.from(b.attributes.normal!.array)).toEqual(Array.from(a.attributes.normal!.array))
    })

    for (const passes of [1, 14, 20]) {
      it(`smoothNormals matches the triangle pass (${kind}, ${passes} passes)`, () => {
        const a = bumpy(kind)
        const b = bumpy(kind)
        a.computeVertexNormals()
        b.computeVertexNormals()
        smoothReference(a.attributes.normal as BufferAttribute, a.index!.array, passes)
        smoothNormals(b.attributes.normal as BufferAttribute, b.index!.array, passes)
        const x = a.attributes.normal!.array
        const y = b.attributes.normal!.array
        let worst = 0
        for (let i = 0; i < x.length; i++) worst = Math.max(worst, Math.abs(x[i]! - y[i]!))
        // only the order of the additions changes: float rounding, far below one 8-bit color step
        expect(worst).toBeLessThan(1e-5)
      })
    }
  }
})

describe('fast chord (v13): same chord as before', () => {
  it('chordFlat gives exactly chord, on both axes', async () => {
    const { chord, chordFlat } = await import('./volume')
    const pts = Array.from({ length: 192 }, (_, i) => {
      const a = (i / 192) * Math.PI * 2
      const r = 90 + 12 * Math.sin(5 * a) + 4 * Math.cos(3 * a)
      return { x: r * Math.cos(a), y: r * Math.sin(a) * 1.1 }
    })
    for (const axis of ['v', 'h'] as const) {
      const U = Float64Array.from(pts, (p) => (axis === 'v' ? p.y : p.x))
      const W = Float64Array.from(pts, (p) => (axis === 'v' ? p.x : p.y))
      for (let v = -120; v <= 120; v += 0.73) expect(chordFlat(U, W, v)).toEqual(chord(pts, v, axis))
    }
  })
})
