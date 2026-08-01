// T12 — Album cong, kéo ngang được, có quán tính và snap.
// Dãy ảnh nằm trên một cung tròn (độ cong tính ở JS), shader lo phần "cảm giác":
// RGB-shift + nghiêng theo tốc độ kéo — thứ mà fade phẳng không bao giờ có.
//
// Cả dãy sống trong một <group> được scale theo khung nhìn, nên mọi khoảng cách
// bên dưới đều là đơn vị LOCAL, không phụ thuộc kích thước màn hình.
import { useMemo, useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GALLERY, PALETTE, HERO_PHOTOS } from '../config.js'
import { getTexture, ensureLoaded, prefetchAll } from '../lib/textures.js'
import { scrollState } from '../lib/scroll.js'
import { galleryState } from '../lib/gallery.js'

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

// ---------------------------------------------------------------------------
//  Giữ VRAM trong mức điện thoại chịu được.
//
//  three.js KHÔNG BAO GIỜ tự nhả texture: tấm nào đã được vẽ một lần là nằm lại
//  trong VRAM tới lúc đóng tab. Khách xem hết album một lượt là cả 40 tấm nằm
//  hết cùng lúc: 40 × (1066×1600×4 byte) × 1.33 (mipmap) = 347MB. Máy bàn thừa
//  sức (đã đo trên M1 Pro: chạy đủ 40), nhưng điện thoại thì vượt hạn mức →
//  lệnh upload thất bại và tấm đó hiện ra ô trống. Đó cũng là lý do MỖI LẦN mở
//  lại thấy MẤY TẤM KHÁC bị mất, chứ không cố định tấm nào — dấu hiệu của thiếu
//  bộ nhớ, chứ lỗi logic thì sẽ sai y một chỗ.
//
//  Nhả ở đây chỉ nhả bản trên GPU. Ảnh đã tải vẫn nằm nguyên trong RAM (chính
//  cái <img> đó), nên nạp lại KHÔNG phát thêm request — vẫn đúng yêu cầu "tải
//  một lần luôn".
//
//  Hai ngưỡng lệch nhau (nhả ở 5 ô, nạp lại ở 4 ô) để tấm nằm đúng ranh giới
//  không bị nhả–nạp qua lại mỗi frame. Vùng ±5 ô là 11 tấm ≈ 100MB.
// ---------------------------------------------------------------------------
const NHA_GPU = GAP * 5
const NAP_GPU = GAP * 4

// Lùi cả dãy ảnh ra SAU mọi vật thể 3D (đơn vị world, không phải local).
//
// Trước đây dãy nằm đúng z = 0 — CÙNG CHỖ với đôi nhẫn ở màn hồi kết. Nhẫn là
// khối đặc: nửa trước của nó ghi depth nên che được ảnh, còn nửa sau thì bị
// tấm ảnh (mờ ~50%) phủ đè lên, bạc trắng ra. Nhìn y như nhẫn bị tấm hình cắt
// mất một khúc, với đường ranh sắc lẻm ngay chỗ mặt phẳng ảnh xuyên qua.
//
// 2.6 là số ĐO ĐƯỢC chứ không áng chừng. Quét 60 tư thế xoay của đôi nhẫn ở cỡ
// thật (scale 0.85, màn ngang): chỗ nhẫn với ra sau xa nhất là z = −1.71. Còn
// tấm ảnh giữa thì bản thân nó cũng nghiêng theo con trỏ (rotation.x/y ±0.06)
// nên mép ảnh chồm tới trước thêm ~0.28. 2.6 − 0.28 = −2.32, vẫn sau nhẫn
// một khoảng 0.6 — không tư thế nào chạm nhau.
const LUI = 2.6

const vertex = /* glsl */ `
  uniform float uSpeed;
  uniform float uGhost;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    // Kéo nhanh → ảnh xiên đi như bị gió tạt. Đúng ở album (khách đang kéo tay),
    // nhưng ở chế độ nền màn mở đầu thì KHÔNG: album tự đổi ảnh mỗi mấy giây,
    // ảnh nền tự dưng méo xiên đi trông như lỗi hiển thị.
    pos.x += pos.y * uSpeed * 0.12 * (1.0 - uGhost);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const fragment = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uSpeed;
  uniform float uFocus;    // 1 = ảnh đang ở giữa
  uniform float uOpacity;
  uniform float uGhost;    // 1 = đang làm nền màn mở đầu (0 = album thật)
  uniform float uBlur;     // độ nhoè, chỉ dùng khi uGhost = 1
  uniform vec2  uCover;
  uniform vec3  uTint;
  varying vec2 vUv;

  void main() {
    vec2 uv = (vUv - 0.5) / uCover + 0.5;
    vec2 q = abs(vUv - 0.5) * 2.0;
    vec3 col;

    // ======================= Chế độ ảnh nền màn mở đầu =======================
    // Điều kiện là uGhost, KHÔNG phải uBlur: người dùng có thể chọn blur = 0 mà
    // vẫn đang ở chế độ nền. Trước đây gộp hai thứ này nên khi blur = 0 nó rơi
    // vào nhánh album, kéo theo cả RGB-shift — ảnh nền tĩnh mà viền tách màu
    // cầu vồng, nhìn như in lỗi.
    if (uGhost > 0.5) {
      if (uBlur > 0.001) {
        // Nhoè bằng 9 điểm lấy mẫu. Rẻ (chỉ 7 tấm hiện cùng lúc) mà quan trọng
        // hơn: nhoè THẬT thì tên cô dâu chú rể nằm đè lên mới đọc được. Chỉ hạ
        // sáng mà giữ ảnh nét thì chi tiết ảnh cắt vào nét chữ, rối mắt.
        float r = 0.011 * uBlur;
        col  = texture2D(uTex, uv).rgb * 0.25;
        col += texture2D(uTex, uv + vec2( r, 0.0)).rgb * 0.125;
        col += texture2D(uTex, uv + vec2(-r, 0.0)).rgb * 0.125;
        col += texture2D(uTex, uv + vec2(0.0,  r)).rgb * 0.125;
        col += texture2D(uTex, uv + vec2(0.0, -r)).rgb * 0.125;
        col += texture2D(uTex, uv + vec2( r,  r)).rgb * 0.0625;
        col += texture2D(uTex, uv + vec2(-r,  r)).rgb * 0.0625;
        col += texture2D(uTex, uv + vec2( r, -r)).rgb * 0.0625;
        col += texture2D(uTex, uv + vec2(-r, -r)).rgb * 0.0625;
      } else {
        // blur = 0 → giữ nét, nhưng KHÔNG có RGB-shift
        col = texture2D(uTex, uv).rgb;
      }

      // Ám nhẹ tông xanh đêm của thiệp cho ảnh hoà vào nền, đừng nổi lên như
      // một tấm hình dán đè. Hạ sáng vừa phải thôi — hạ mạnh (từng thử 0.62) là
      // ảnh biến mất hẳn, chỉ còn mấy vệt mờ, không ra ảnh cưới nữa.
      col = mix(col, col * vec3(0.62, 0.78, 0.9), 0.35) * 0.9;

      // rìa ảnh tan dần, không có mép cứng — nhìn ra hậu cảnh chứ không ra khung
      // ảnh. Bắt đầu tan muộn (0.82) để giữ được phần lớn khuôn hình.
      // Cũng KHÔNG có viền vàng: viền là để đánh dấu ảnh đang chọn ở album.
      float soft = 1.0 - smoothstep(0.82, 1.04, max(q.x, q.y));
      gl_FragColor = vec4(col, soft * uOpacity);
      #include <colorspace_fragment>
      return;
    }

    // ============================ Chế độ album ==============================
    // RGB shift theo tốc độ kéo
    float s = clamp(uSpeed, -1.5, 1.5) * 0.012;
    col.r = texture2D(uTex, uv + vec2(s, 0.0)).r;
    col.g = texture2D(uTex, uv).g;
    col.b = texture2D(uTex, uv - vec2(s, 0.0)).b;

    // ảnh rìa: tối, ám vàng. Ảnh giữa: rực rỡ.
    col = mix(col * 0.4 + uTint * 0.1, col, uFocus * 0.8 + 0.2);

    // hạ sáng một chút: ảnh cưới toàn váy trắng + tường kem, để nguyên là
    // Bloom bám vào rồi cả tấm ảnh trắng xoá như phủ sương.
    col *= 0.88;

    // bo góc mềm
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
  // 0 khi ảnh thật chưa về, dâng lên 1 khi đã về — xem chỗ dùng ở useFrame
  const hienRa = useRef(0)
  const tex = useMemo(() => getTexture(item.src, { label: item.caption, seed: index + 20 }), [item, index])

  const uniforms = useMemo(
    () => ({
      uTex: { value: tex },
      uSpeed: { value: 0 },
      uFocus: { value: 0 },
      uOpacity: { value: 0 },
      uGhost: { value: 0 },
      uBlur: { value: 0 },
      uCover: { value: new THREE.Vector2(1, 1) },
      uTint: { value: new THREE.Color(PALETTE.gold) },
    }),
    [tex],
  )

  useFrame((_, dt) => {
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
    const ax = Math.abs(x)
    if (ax < GAP * 6) ensureLoaded(item.src)

    // Nhả texture khỏi GPU khi ảnh đi xa khỏi tầm nhìn — xem NHA_GPU.
    // File ảnh vẫn nằm nguyên trong RAM nên nạp lại KHÔNG tốn thêm request nào.
    if (ax > NHA_GPU) {
      if (tex.userData.tren_gpu) {
        tex.dispose()
        tex.userData.tren_gpu = false
      }
    } else if (ax < NAP_GPU && !tex.userData.tren_gpu) {
      // dispose() đã xoá bản upload cũ, đánh dấu để three.js nạp lại
      tex.needsUpdate = true
      tex.userData.tren_gpu = true
    }

    const focus = Math.max(0, 1 - Math.abs(x) / (GAP * 1.15))
    const zoom = 0.88 + focus * 0.2

    // Khung ăn theo tỉ lệ ảnh THẬT: chiều cao cố định, chiều ngang co giãn.
    // Nhờ vậy ảnh ngang không bị cắt cụt đầu–chân như khi ép vào khung dọc.
    //
    // MỘT công thức duy nhất cho mọi màn. Cỡ ảnh to dần rồi nhỏ lại là do
    // group scale phình theo tiến độ cuộn (xem `phinh` bên dưới) — liên tục,
    // KHÔNG có chỗ nào nhảy giật.
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
    u.uBlur.value = shared.current.blur

    // Ở chế độ làm nền màn mở đầu, ảnh KHÔNG được che cụm hạt.
    //
    // Vì sao trước đây bị che: tấm ở giữa nằm đúng z = 0, cùng độ sâu với cụm
    // hạt, mà ảnh thì ghi depth (mặc định bật) còn hạt thì depthWrite: false.
    // Thành ra mấy tấm nghiêng chồm ra trước ghi depth xong là hạt bị loại khỏi
    // khung. Tắt ghi depth + đẩy xuống vẽ trước là hạt luôn nổi lên trên.
    const nen = shared.current.ghost > 0.5
    u.uGhost.value = nen ? 1 : 0
    mat.current.depthWrite = !nen
    // renderOrder phải đặt trên TỪNG mesh — three.js sắp xếp theo từng object,
    // đặt ở group cha không có tác dụng.
    mesh.current.renderOrder = nen ? -2 : 0
    // Chỉ giữ ~7 ảnh quanh tâm, còn lại tắt hẳn: vừa đỡ tốn, vừa không thấy
    // ảnh "nhảy" ở mép lúc dãy gấp vòng.
    const fade = 1 - THREE.MathUtils.smoothstep(Math.abs(x), GAP * 2.5, GAP * 3.4)

    // Chưa có ảnh THẬT thì ẩn hẳn, tuyệt đối không hiện thẻ giữ chỗ.
    //
    // Thẻ giữ chỗ in đúng dòng "thả ảnh vào public/photos/" — lời nhắn cho lập
    // trình viên, không phải cho khách mời. Ảnh về chậm vài giây (mạng điện
    // thoại) là khách đọc thấy dòng đó ngay cạnh tên cô dâu chú rể. Thà trống
    // một lát: nền ảnh vốn chỉ là trang trí, thiếu vài giây không ai nhận ra.
    //
    // Dâng lên bằng damp chứ không bật phựt: ảnh về là nó hiện ra êm.
    hienRa.current = THREE.MathUtils.damp(hienRa.current, tex.userData.real ? 1 : 0, 6, Math.min(dt, 0.05))

    u.uOpacity.value = shared.current.opacity * fade * hienRa.current
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

// `ghost` = đang làm NỀN cho một màn nào đó (mờ + tối, không bấm được), khác hẳn
// `active` = đang là màn album thật (nét, kéo ngang được).
export default function CurvedGallery({ active = true, ghost = false }) {
  const { viewport, camera } = useThree()
  const shared = useRef({ speed: 0, opacity: 0, blur: 0, ghost: 0, k: 1 })
  const group = useRef()

  // Tải HẾT cả album, càng sớm càng tốt.
  //
  // KHÔNG dựa vào vùng ±N ô quanh tâm để tải: kéo nhanh là offset nhảy qua cả
  // vùng đó trong một frame, ảnh không bao giờ được yêu cầu và khách chỉ thấy
  // ảnh giữ chỗ (đã đo trên bản chạy thật: 8/40 ảnh được request).
  //
  // Hoãn 2.5 giây là QUÁ MUỘN: ảnh giờ còn làm nền cho các màn khác nữa, mà
  // khách cuộn nhanh thì tới nơi ảnh vẫn chưa về. Chỉ chờ 300ms cho khung hình
  // đầu kịp vẽ, rồi tải ồ ạt — cả album 2.6MB, không đáng phải rón rén.
  useEffect(() => {
    const urls = GALLERY.map((g) => g.src)
    const t = setTimeout(() => prefetchAll(urls), 300)
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
      // Ở chế độ nền màn mở đầu cũng tự đổi ảnh, theo nhịp riêng trong config.
      const settled = Math.abs(galleryState.target - galleryState.offset) < 0.01
      const nhip = active ? AUTO_MS : (HERO_PHOTOS.every ?? 5) * 1000
      if ((active || ghost) && settled && performance.now() - galleryState.lastInput > nhip) {
        galleryState.target += GAP
        galleryState.lastInput = performance.now()
      }
    }

    galleryState.index =
      ((Math.round(galleryState.offset / GAP) % GALLERY.length) + GALLERY.length) % GALLERY.length

    // RGB shift ăn theo tốc độ dịch THỰC TẾ của frame này
    const frameVel = (galleryState.offset - prev) / Math.max(d, 0.001)
    s.speed += (frameVel * 0.9 - s.speed) * 0.18
    // Ba trạng thái: album thật (1) → nền màn mở đầu (mờ) → tắt (0)
    const dich = active ? 1 : ghost ? (HERO_PHOTOS.opacity ?? 0.3) : 0
    s.opacity = THREE.MathUtils.damp(s.opacity, dich, 5, d)
    // Album thật thì KHÔNG nhoè. Chỉ nhoè khi đang làm nền.
    s.blur = THREE.MathUtils.damp(s.blur, active ? 0 : ghost ? (HERO_PHOTOS.blur ?? 1.15) : 0, 5, d)
    // Cờ "đang làm nền" — phải tách riêng khỏi `blur`, vì blur có thể để 0 mà
    // vẫn đang ở chế độ nền (người dùng chọn không làm mờ).
    s.ghost = !active && ghost ? 1 : 0

    if (group.current) {
      group.current.visible = s.opacity > 0.01
      const narrow = viewport.width < viewport.height

      const kBase = narrow
        ? Math.min(viewport.width * 0.82, viewport.height * 0.4)
        : Math.min(viewport.width * 0.26, viewport.height * 0.5)

      // Phình dần theo tiến độ cuộn, ĐÚNG NHỊP với camera (`z = 9 − sin(p·π)·1.5`
      // trong CameraRig). Album nằm giữa trang nên nó rơi đúng đỉnh — ảnh lớn
      // nhất ở đó, rồi nhỏ lại về cuối.
      //
      // Cố ý KHÔNG đổi cỡ theo màn đang xem: làm vậy là ảnh nhảy giật một cái
      // khi bước vào album. Cả trang chỉ có MỘT công thức, chạy liên tục.
      //
      // Nhân thêm 1.18 ở đỉnh, cộng với 1.2 lần camera tiến vào, ra khoảng 1.4
      // lần so với màn mở đầu — đủ để ảnh gần lấp chiều cao màn ở album mà ảnh
      // ngang (rộng gấp 2.25 lần ảnh dọc) vẫn không tràn hai mép.
      const phinh = 1 + Math.sin(scrollState.smooth * Math.PI) * (HERO_PHOTOS.swell ?? 0.18)

      // Chặn trên, tính từ hình học chứ không hardcode theo thiết bị: ảnh DỌC
      // (29 trong 40 tấm) không được vượt 96% bề ngang màn vào lúc camera tiến
      // gần nhất — chỗ đó khung nhìn hẹp lại 1.2 lần.
      //
      // Không chặn thì máy bàn vẫn thoải mái (chỉ 34%) nhưng ĐIỆN THOẠI tràn:
      // tính ra 109% bề ngang ở đỉnh, ảnh dọc bị cắt cụt hai bên.
      const wDoc = THREE.MathUtils.clamp(0.666 * H, MIN_W, MAX_W) * 1.08
      const phinhMax = Math.max(1, (viewport.width * 0.96) / (kBase * wDoc * 1.2))

      // Khoảng cách các tấm cũng phình theo (vì nằm cùng group) → không bao giờ
      // chồng nhau, khỏi phải tính lại GAP.
      // Lùi ra sau thì phối cảnh làm ảnh nhỏ đi — nhân bù lại đúng bằng tỉ lệ
      // khoảng cách, nên cỡ ảnh TRÊN MÀN HÌNH không đổi một pixel nào. Phải lấy
      // camera.position.z sống (camera có tiến/lùi theo cuộn) chứ không hằng số,
      // nếu không thì nhịp phình ở giữa trang sẽ lệch đi.
      const bu = (camera.position.z + LUI) / camera.position.z

      // Nhân SAU khi đã kẹp phinhMax: kẹp đó tính theo bề ngang trên màn hình,
      // mà `bu` chỉ bù lại đúng phần phối cảnh vừa mất — trên màn hình vẫn y hệt.
      s.k = kBase * Math.min(phinh, phinhMax) * bu
      group.current.scale.setScalar(s.k)
      group.current.position.y = 0
      group.current.position.z = -LUI
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
