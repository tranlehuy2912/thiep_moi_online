// T6 — Cánh hoa hồng rơi. InstancedMesh, KHÔNG physics:
// mọi chuyển động là hàm thuần theo thời gian nên CPU chỉ ghi ma trận,
// và cánh hoa tự "wrap" vô hạn khi rơi khỏi khung.
//
// Màu đi qua InstancedBufferAttribute tự khai báo chứ không dùng `instanceColor`
// của three: instanceColor phải tồn tại trước lúc material biên dịch, gán sau là
// ra một màn hoa màu đen.
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../config.js'
import { q } from '../lib/quality.js'
import { scrollState } from '../lib/scroll.js'

// z lệch hẳn về phía sau: cánh hoa trôi ngay trước ống kính sẽ to như cái lá
// và che mất chữ. Camera đứng ở z≈9 nên khoảng này là "xa vừa đủ".
const AREA = { x: 22, y: 15, z: 10, zCenter: -5 }

const vertex = /* glsl */ `
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vFacing;
  void main() {
    vColor = aColor;
    // cánh quay lưng lại thì tối hơn — giả lập ánh sáng xuyên qua cánh mỏng
    vec3 n = normalize(normalMatrix * normal);
    vFacing = 0.45 + 0.55 * abs(n.z);
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`

const fragment = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vFacing;
  void main() {
    gl_FragColor = vec4(vColor * vFacing, uOpacity);
    #include <colorspace_fragment>
  }
`

function petalGeometry() {
  // cánh hoa = nửa hình giọt nước, bẻ cong nhẹ cho có khối
  const shape = new THREE.Shape()
  shape.moveTo(0, -0.5)
  shape.bezierCurveTo(0.42, -0.3, 0.5, 0.28, 0, 0.55)
  shape.bezierCurveTo(-0.5, 0.28, -0.42, -0.3, 0, -0.5)
  const g = new THREE.ShapeGeometry(shape, 10)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    pos.setZ(i, x * x * 0.55 + y * y * 0.12)
  }
  g.computeVertexNormals()
  return g
}

export default function Petals({ count = q().petals }) {
  const mesh = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const geo = useMemo(petalGeometry, [])

  const seeds = useMemo(() => {
    const a = []
    for (let i = 0; i < count; i++) {
      a.push({
        x: (Math.random() - 0.5) * AREA.x,
        y: Math.random() * AREA.y,
        z: (Math.random() - 0.5) * AREA.z + AREA.zCenter,
        fall: 0.3 + Math.random() * 0.7,
        sway: 0.4 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        spinX: (Math.random() - 0.5) * 1.4,
        spinZ: (Math.random() - 0.5) * 1.1,
        size: 0.05 + Math.pow(Math.random(), 2.2) * 0.16,
      })
    }
    return a
  }, [count])

  const colors = useMemo(() => {
    const arr = new Float32Array(count * 3)
    const palette = [
      new THREE.Color(PALETTE.petal),
      new THREE.Color('#F2CBBE'),
      new THREE.Color(PALETTE.goldLight),
      new THREE.Color(PALETTE.gold),
      new THREE.Color('#D98C7A'),
    ]
    const c = new THREE.Color()
    for (let i = 0; i < count; i++) {
      c.copy(palette[(Math.random() * palette.length) | 0])
      c.multiplyScalar(0.7 + Math.random() * 0.55)
      arr.set([c.r, c.g, c.b], i * 3)
    }
    return arr
  }, [count])

  useLayoutEffect(() => {
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3))
  }, [geo, colors])

  const uniforms = useMemo(() => ({ uOpacity: { value: 0.78 } }), [])
  const t = useRef(0)

  useFrame((_, dt) => {
    if (!mesh.current) return
    t.current += Math.min(dt, 0.05)
    const time = t.current
    // cuộn nhanh thì hoa bay dạt — cảm giác gió lùa
    const gust = scrollState.velocity * 0.005

    for (let i = 0; i < count; i++) {
      const s = seeds[i]
      const y = (((s.y - time * s.fall) % AREA.y) + AREA.y) % AREA.y - AREA.y * 0.5
      const x = s.x + Math.sin(time * 0.6 * s.sway + s.phase) * 0.9 + gust * (1 + s.fall)
      const z = s.z + Math.cos(time * 0.4 * s.sway + s.phase) * 0.5

      dummy.position.set(x, y, z)
      dummy.rotation.set(time * s.spinX + s.phase, Math.sin(time * 0.5 + s.phase) * 1.2, time * s.spinZ)
      dummy.scale.setScalar(s.size)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[geo, undefined, count]} frustumCulled={false}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        side={THREE.DoubleSide}
        transparent
        depthWrite={false}
      />
    </instancedMesh>
  )
}
