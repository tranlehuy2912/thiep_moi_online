// Sân khấu 3D: MỘT canvas duy nhất cho cả trang.
// Không dùng nhiều <Canvas> vì mỗi cái là một WebGL context — điện thoại chịu không nổi.
//
// Nền + cánh hoa + đom đóm chạy suốt; "vật thể chính" đổi theo màn đang cuộn tới.
// Màn nào không hiện thì component vẫn còn đó nhưng active=false → nó tự co về 0,
// rẻ hơn nhiều so với mount/unmount (không phải biên dịch lại shader mỗi lần cuộn).
import { Suspense, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'

import Backdrop from './Backdrop.jsx'
import Petals from './Petals.jsx'
import Fireflies from './Fireflies.jsx'
import ParticleMorph from './ParticleMorph.jsx'
import CurvedGallery from './CurvedGallery.jsx'
import Rings from './Rings.jsx'
import Fireworks from './Fireworks.jsx'
import GoldEnvironment from './GoldEnvironment.jsx'

import { scrollState } from '../lib/scroll.js'
import { q, PREFERS_REDUCED } from '../lib/quality.js'
import { SECTIONS, HERO_PHOTOS } from '../config.js'
import { useStore } from '../store.js'

const I = Object.fromEntries(SECTIONS.map((s, i) => [s.id, i]))

// Camera đi một hành trình nhẹ theo scroll. Cố ý KHÔNG bay lượn nhiều:
// khách còn phải đọc chữ, camera động quá là say.
function CameraRig() {
  const { camera, scene } = useThree()
  const target = useRef(new THREE.Vector3())
  // móc gỡ lỗi khi chạy dev (xem README); bản production không có
  if (import.meta.env.DEV) window.__scene = scene

  useFrame((state, dt) => {
    // Móc gỡ lỗi bản dev: state của R3F có `internal.subscribers` + `gl`, đủ để
    // quay tay từng frame khi tab bị ẩn (trình duyệt treo rAF, cảnh đứng hình).
    if (import.meta.env.DEV) window.__r3f = state
    const d = Math.min(dt, 0.05)
    const p = scrollState.smooth

    const z = 9 - Math.sin(p * Math.PI) * 1.5
    const y = p * -0.5
    const x = Math.sin(p * Math.PI * 2) * 0.45

    target.current.set(
      x + scrollState.pointerSmooth.x * 0.3,
      y + scrollState.pointerSmooth.y * 0.22,
      z,
    )
    camera.position.lerp(target.current, 1 - Math.pow(0.002, d))
    camera.lookAt(0, y * 0.6, 0)
    camera.rotation.z = scrollState.pointerSmooth.x * 0.01
  })
  return null
}

function Effects() {
  if (!q().bloom) return null
  return (
    <EffectComposer multisampling={0} disableNormalPass>
      <Bloom
        intensity={0.45}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.22}
        mipmapBlur
        radius={0.62}
      />
      <ChromaticAberration
        offset={[0.0006, 0.0008]}
        blendFunction={BlendFunction.NORMAL}
        radialModulation
        modulationOffset={0.4}
      />
      <Vignette darkness={0.42} offset={0.28} />
    </EffectComposer>
  )
}

export default function Stage() {
  const section = useStore((s) => s.section)
  const tier = q()

  // Mỗi màn một "vật thể chính" duy nhất. Màn `details` cố ý KHÔNG có gì:
  // ở đó hai thẻ thông tin mới là nội dung, thêm 3D vào chỉ làm rối.
  const showHero = section === I.hero
  const showGallery = section === I.gallery
  const showRings = section === I.outro

  return (
    <Canvas
      className="stage"
      dpr={[1, tier.dpr]}
      gl={{
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
      }}
      camera={{ position: [0, 0, 9], fov: 45, near: 0.1, far: 100 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 0.92
      }}
    >
      <Suspense fallback={null}>
        <Backdrop calm={showGallery} />
        <GoldEnvironment />
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 5, 4]} intensity={2.2} color="#FFD79A" />

        <ParticleMorph active={showHero} />
        {/* ghost = dùng chính dãy ảnh này làm nền mờ. Đang THỬ — tắt bằng
            HERO_PHOTOS.enabled trong config.js, màn album không đổi.
            Luôn loại trừ màn album: ở đó `active` mới là chế độ đúng (ảnh nét,
            kéo được, bấm xem to). Bật cả hai cùng lúc là ảnh vừa nét vừa mờ. */}
        <CurvedGallery
          active={showGallery}
          ghost={HERO_PHOTOS.enabled && !showGallery && (HERO_PHOTOS.everywhere || showHero)}
        />
        <Rings active={showRings} />

        {!PREFERS_REDUCED && (
          <>
            <Petals />
            <Fireflies />
          </>
        )}

        {/* Luôn gắn, kể cả khi khách bật "giảm chuyển động": nó chỉ nằm im chờ
            (visible=false, không có lệnh vẽ nào) và giữ cho hàng đợi được rút.
            Chỗ chặn giảm-chuyển-động nằm trong celebrate() ở lib/burst.js. */}
        <Fireworks />


        <CameraRig />
        <Effects />
      </Suspense>
    </Canvas>
  )
}
