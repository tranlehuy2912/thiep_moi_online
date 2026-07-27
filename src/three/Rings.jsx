// T5 — Đôi nhẫn cưới vàng. Hình học tạo bằng code, 0 byte tải về.
//
// Vàng là kim loại: `metalness = 1` nên toàn bộ vẻ lấp lánh đến từ những gì nó
// PHẢN CHIẾU. Không có environment map thì nhẫn sẽ ra đen sì — env map dựng ở
// Stage.jsx (GoldEnvironment), đừng bỏ nó đi.
import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../config.js'
import { scrollState } from '../lib/scroll.js'
import { RING_LINK_SOLID } from '../lib/shapes.js'

const R = 1 // bán kính nhẫn, đơn vị local — cỡ thật do group scale quyết định

function GoldBand({ tube }) {
  return (
    <mesh>
      <torusGeometry args={[R, tube, 32, 180]} />
      <meshPhysicalMaterial
        color={PALETTE.gold}
        metalness={1}
        roughness={0.13}
        envMapIntensity={3.2}
        clearcoat={0.7}
        clearcoatRoughness={0.12}
      />
    </mesh>
  )
}

export default function Rings({ active = true }) {
  const group = useRef()
  const t = useRef(0)
  const { viewport } = useThree()

  useFrame((_, dt) => {
    if (!group.current) return
    t.current += Math.min(dt, 0.05)
    const g = group.current
    g.rotation.y = t.current * 0.35 + scrollState.pointerSmooth.x * 0.5
    g.rotation.x = Math.sin(t.current * 0.4) * 0.12 + scrollState.pointerSmooth.y * -0.25

    // ngồi ở nửa trên khung hình, giống cụm hạt ở màn hero — chừa nửa dưới cho chữ
    const narrow = viewport.width < viewport.height
    const k = narrow ? 0.62 : 0.85
    g.position.y = viewport.height * (narrow ? 0.28 : 0.25) + Math.sin(t.current * 0.7) * 0.1

    const target = active ? k : 0.001
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, target, 4, dt))
    g.visible = g.scale.x > 0.02
  })

  const { tiltB, dx, tube, poseX, poseY } = RING_LINK_SOLID

  return (
    <group ref={group} scale={0.001}>
      {/* Dáng chung của cả cặp. TorusGeometry nằm trong mặt phẳng XY. */}
      <group rotation={[poseX, poseY, 0]}>
        {/* dồn cặp nhẫn về giữa — nếu không, tâm xoay lệch hẳn sang nhẫn A */}
        <group position={[(-R * dx) / 2, 0, 0]}>
          {/* Nhẫn A: nằm yên trong mặt phẳng XY */}
          <GoldBand tube={tube} />

          {/* Nhẫn B: dời theo X rồi xoay quanh chính trục X.
              Phải là trục X — trục CÙNG HƯỚNG với độ dời. Xoay quanh Y (như
              bản cũ) thì hai điểm xuyên mặt phẳng nhẫn A cách tâm bằng nhau,
              không đời nào lồng được, chỉ chồng lên nhau. */}
          <group position={[R * dx, 0, 0]} rotation={[tiltB, 0, 0]}>
            <GoldBand tube={tube} />
          </group>
        </group>
      </group>

      {/* đèn riêng cho khu vực nhẫn: tạo vệt sáng chạy dọc vành khi nhẫn xoay */}
      <pointLight position={[2.2, 2.6, 3]} intensity={26} color={PALETTE.sun} distance={14} />
      <pointLight position={[-2.6, -1.2, 2]} intensity={12} color={PALETTE.goldLight} distance={14} />
    </group>
  )
}
