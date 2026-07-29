// T12 — Album cong, kéo ngang được, có quán tính và snap.
// Dãy ảnh nằm trên một cung tròn (độ cong tính ở JS), shader lo phần "cảm giác":
// RGB-shift + nghiêng theo tốc độ kéo — thứ mà fade phẳng không bao giờ có.
//
// Cả dãy sống trong một <group> được scale theo khung nhìn, nên mọi khoảng cách
// bên dưới đều là đơn vị LOCAL, không phụ thuộc kích thước màn hình.
import { useMemo, useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GALLERY, PALETTE } from '../config.js'
import { getTexture, ensureLoaded, prefetchAll } from '../lib/textures.js'
import { scrollState } from '../lib/scroll.js'

export const galleryState = {
  offset: 0, // vị trí hiện tại của dãy ảnh
  target: 0, // vị trí ĐÍCH — dãy luôn damp về đây, nhờ vậy ảnh luôn dừng thẳng
  dragging: false,
  index: 0,
  lastInput: 0,
}

// Kéo bao nhiêu pixel thì sang một ảnh: GAP / GAIN ≈ 130px.
// Trước đây GAIN = 0.006 → phải kéo gần 360px, nặng như kéo tạ.
const GAIN = 0.0165
// Lúc thả tay, chiếu vị trí về trước bấy nhiêu giây theo vận tốc rồi mới làm
// tròn. Đây là thứ khiến một cú vuốt ~25px cũng sang được ảnh khác.
const PROJECT = 0.12
// Không ai chạm bao lâu thì album tự sang ảnh
const AUTO_MS = 4500

// Khoảng cách giữa hai ảnh, đơn vị local. Phải đủ rộng cho tấm NGANG nhất
// (xem MAX_W) — album trộn cả ảnh dọc lẫn ảnh ngang.
const GAP = 2.15
const H = 1.3 // chiều cao khung, cố định cho mọi ảnh
const MIN_W = 0.8
const MAX_W = 1.95
const SPAN = () => GALLERY.length * GAP

const vertex = /* glsl */ `
  uniform float uSpeed;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    // kéo nhanh → ảnh xiên đi như bị gió tạt
    pos.x += pos.y * uSpeed * 0.12;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const fragment = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uSpeed;
  uniform float uFocus;    // 1 = ảnh đang ở giữa
  uniform float uOpacity;
  uniform vec2  uCover;
  uniform vec3  uTint;
  varying vec2 vUv;

  void main() {
    vec2 uv = (vUv - 0.5) / uCover + 0.5;

    // RGB shift theo tốc độ kéo
    float s = clamp(uSpeed, -1.5, 1.5) * 0.012;
    vec3 col;
    col.r = texture2D(uTex, uv + vec2(s, 0.0)).r;
    col.g = texture2D(uTex, uv).g;
    col.b = texture2D(uTex, uv - vec2(s, 0.0)).b;

    // ảnh rìa: tối, ám vàng. Ảnh giữa: rực rỡ.
    col = mix(col * 0.4 + uTint * 0.1, col, uFocus * 0.8 + 0.2);

    // hạ sáng một chút: ảnh cưới toàn váy trắng + tường kem, để nguyên là
    // Bloom bám vào rồi cả tấm ảnh trắng xoá như phủ sương.
    col *= 0.88;

    // bo góc mềm
    vec2 q = abs(vUv - 0.5) * 2.0;
    float corner = 1.0 - smoothstep(0.9, 1.0, max(q.x, q.y));

    // viền vàng mảnh quanh ảnh đang được chọn
    float frame = smoothstep(0.93, 0.97, max(q.x, q.y)) * (1.0 - smoothstep(0.985, 1.0, max(q.x, q.y)));
    col += uTint * frame * uFocus * 1.2;

    gl_FragColor = vec4(col, corner * uOpacity);
    #include <colorspace_fragment>
  }
`

function Slide({ item, index, total, shared }) {
  const mesh = useRef()
  const mat = useRef()
  const tex = useMemo(() => getTexture(item.src, { label: item.caption, seed: index + 20 }), [item, index])

  const uniforms = useMemo(
    () => ({
      uTex: { value: tex },
      uSpeed: { value: 0 },
      uFocus: { value: 0 },
      uOpacity: { value: 0 },
      uCover: { value: new THREE.Vector2(1, 1) },
      uTint: { value: new THREE.Color(PALETTE.gold) },
    }),
    [tex],
  )

  useFrame(() => {
    const u = mat.current?.uniforms
    if (!u || !mesh.current) return
    const span = SPAN()

    // gấp vòng để dãy ảnh là vô hạn
    let x = index * GAP - galleryState.offset
    x = (((x % span) + span * 1.5) % span) - span * 0.5

    // Cung tròn — nhưng chỉ cong ở vùng quanh tâm. Không kẹp thì ảnh thứ 20
    // sẽ nằm ở z = -300 và quay lộn tùng phèo.
    const xc = THREE.MathUtils.clamp(x, -GAP * 4, GAP * 4)
    mesh.current.position.x = x
    mesh.current.position.z = -xc * xc * 0.075
    mesh.current.rotation.y = -xc * 0.13
    mesh.current.position.y = Math.sin(xc * 0.4) * 0.04

    // Ảnh sắp vào tầm nhìn thì tải NGAY, chen trước hàng đợi nền.
    // Nới từ GAP*4 lên GAP*6: vùng hiện hình tắt hẳn ở GAP*3.4, chừa rộng hơn
    // để lúc kéo nhanh ảnh kịp về trước khi tới giữa khung.
    if (Math.abs(x) < GAP * 6) ensureLoaded(item.src)

    const focus = Math.max(0, 1 - Math.abs(x) / (GAP * 1.15))
    const zoom = 0.88 + focus * 0.2

    // Khung ăn theo tỉ lệ ảnh THẬT: chiều cao cố định, chiều ngang co giãn.
    // Nhờ vậy ảnh ngang không bị cắt cụt đầu–chân như khi ép vào khung dọc.
    const img = tex.image
    let w = MIN_W
    if (img?.width) w = THREE.MathUtils.clamp((img.width / img.height) * H, MIN_W, MAX_W)
    mesh.current.scale.set(w * zoom, H * zoom, 1)

    // uCover chỉ còn phải xử lý phần dư khi ảnh chạm giới hạn MIN_W / MAX_W
    if (img?.width) {
      const texAspect = img.width / img.height
      const boxAspect = w / H
      if (texAspect > boxAspect) u.uCover.value.set(boxAspect / texAspect, 1)
      else u.uCover.value.set(1, texAspect / boxAspect)
    }

    u.uFocus.value = focus
    u.uSpeed.value = shared.current.speed
    // Chỉ giữ ~7 ảnh quanh tâm, còn lại tắt hẳn: vừa đỡ tốn, vừa không thấy
    // ảnh "nhảy" ở mép lúc dãy gấp vòng.
    const fade = 1 - THREE.MathUtils.smoothstep(Math.abs(x), GAP * 2.5, GAP * 3.4)
    u.uOpacity.value = shared.current.opacity * fade
    mesh.current.visible = u.uOpacity.value > 0.01
  })

  return (
    <mesh ref={mesh} frustumCulled={false}>
      <planeGeometry args={[1, 1, 16, 16]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export default function CurvedGallery({ active = true }) {
  const { viewport } = useThree()
  const shared = useRef({ speed: 0, opacity: 0 })
  const group = useRef()

  // Tải nốt cả album ở chế độ nền.
  //
  // KHÔNG dựa vào vùng ±N ô quanh tâm để tải: kéo nhanh là offset nhảy qua cả
  // vùng đó trong một frame, ảnh không bao giờ được yêu cầu và khách chỉ thấy
  // ảnh giữ chỗ (đã đo trên bản chạy thật: 8/40 ảnh được request).
  //
  // Hoãn 2.5 giây để không giành băng thông với khung hình đầu và với font.
  useEffect(() => {
    const urls = GALLERY.map((g) => g.src)
    const t = setTimeout(() => prefetchAll(urls), 2500)
    return () => clearTimeout(t)
  }, [])

  // Khách đã tới màn album thì kéo hàng đợi lên ngay, khỏi chờ nốt 2.5 giây.
  useEffect(() => {
    if (active) prefetchAll(GALLERY.map((g) => g.src))
  }, [active])

  // Kéo bằng chuột / ngón tay.
  // Nghe ở window vì lớp HTML nằm đè lên canvas; chỉ nhận nếu bắt đầu trong vùng album.
  useEffect(() => {
    let down = false
    let lastX = 0
    let lastT = 0
    let vel = 0 // đơn vị local trên mỗi giây

    const start = (e) => {
      if (!e.target?.closest?.('[data-gallery-drag]')) return
      down = true
      galleryState.dragging = true
      galleryState.target = null
      lastX = e.clientX
      lastT = performance.now()
      vel = 0
    }

    const move = (e) => {
      if (!down) return
      const now = performance.now()
      const dt = Math.max(1, now - lastT)
      const d = -(e.clientX - lastX) * GAIN
      lastX = e.clientX
      lastT = now
      galleryState.offset += d
      // vận tốc làm mượt để một frame giật không quyết định cả cú vuốt
      vel = vel * 0.65 + ((d / dt) * 1000) * 0.35
    }

    const end = () => {
      if (!down) return
      down = false
      galleryState.dragging = false
      galleryState.lastInput = performance.now()

      // `vel` chỉ được cập nhật trong pointermove. Nếu khách kéo rồi GIỮ YÊN
      // một lúc mới nhả, vel vẫn còn giá trị cũ và dãy ảnh sẽ phóng đi như bị
      // vuốt — sai. Nên làm nguội vel theo thời gian kể từ lần di chuyển cuối.
      const stale = performance.now() - lastT
      const v = stale >= 120 ? 0 : vel * (1 - stale / 120)

      // Chiếu vị trí về trước theo vận tốc lúc thả tay rồi mới làm tròn.
      // Cách này đúng cho cả ba kiểu thao tác, không cần chia trường hợp:
      //   • vuốt nhẹ            → đi tiếp đúng 1 ảnh
      //   • kéo chậm đúng 1 ảnh → dừng ở chính ảnh đó, không vượt thêm
      //   • thả tay tại chỗ     → về ảnh gần nhất
      const from = Math.round(galleryState.offset / GAP)
      const to = Math.round((galleryState.offset + v * PROJECT) / GAP)
      // chặn ±3 ảnh để cú vuốt thật mạnh không phóng đi mất hút
      galleryState.target = THREE.MathUtils.clamp(to, from - 3, from + 3) * GAP
    }

    window.addEventListener('pointerdown', start)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointerdown', start)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [])

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05)
    const s = shared.current
    const prev = galleryState.offset

    if (!galleryState.dragging) {
      if (galleryState.target == null) {
        galleryState.target = Math.round(galleryState.offset / GAP) * GAP
      }
      galleryState.offset = THREE.MathUtils.damp(galleryState.offset, galleryState.target, 7, d)

      // Đã bỏ dòng chữ "kéo ngang để xem tiếp", nên album tự sang ảnh sau vài
      // giây không ai chạm — đó chính là thứ cho khách biết còn ảnh phía sau.
      const settled = Math.abs(galleryState.target - galleryState.offset) < 0.01
      if (active && settled && performance.now() - galleryState.lastInput > AUTO_MS) {
        galleryState.target += GAP
        galleryState.lastInput = performance.now()
      }
    }

    galleryState.index =
      ((Math.round(galleryState.offset / GAP) % GALLERY.length) + GALLERY.length) % GALLERY.length

    // RGB shift ăn theo tốc độ dịch THỰC TẾ của frame này
    const frameVel = (galleryState.offset - prev) / Math.max(d, 0.001)
    s.speed += (frameVel * 0.9 - s.speed) * 0.18
    s.opacity = THREE.MathUtils.damp(s.opacity, active ? 1 : 0, 5, d)

    if (group.current) {
      group.current.visible = s.opacity > 0.01
      // Màn album không còn tiêu đề nào → ảnh được căn giữa và to hơn trước
      const narrow = viewport.width < viewport.height
      const k = narrow
        ? Math.min(viewport.width * 0.82, viewport.height * 0.4)
        : Math.min(viewport.width * 0.26, viewport.height * 0.5)
      group.current.scale.setScalar(k)
      group.current.position.y = 0
      group.current.rotation.x = scrollState.pointerSmooth.y * -0.06
      group.current.rotation.y = scrollState.pointerSmooth.x * 0.05
    }
  })

  return (
    <group ref={group}>
      {GALLERY.map((item, i) => (
        <Slide key={i} item={item} index={i} total={GALLERY.length} shared={shared} />
      ))}
    </group>
  )
}
