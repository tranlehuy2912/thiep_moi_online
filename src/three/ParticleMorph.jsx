// ⭐ T1 + T2 — Particle Morphing
// Một hệ hạt duy nhất. Mỗi hạt mang sẵn vị trí của nó ở HAI hình (A và B);
// việc morph diễn ra hoàn toàn trong vertex shader nên CPU gần như rảnh.
//
// Hai chi tiết làm nên khác biệt (thiếu là trông rẻ tiền ngay):
//   • stagger — mỗi hạt khởi hành lệch pha, hình tan/tụ dần chứ không trượt cả khối
//   • bulge   — hạt phình ra theo curl noise ở giữa đường bay rồi mới thu về đích
import { useMemo, useRef, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { NOISE } from './shaders/noise.glsl.js'
import {
  heartPoints,
  ringsPoints,
  textPoints,
  monogramPoints,
  spherePoints,
  waitForFonts,
} from '../lib/shapes.js'
import { PALETTE, PARTICLE } from '../config.js'
import { q } from '../lib/quality.js'
import { scrollState } from '../lib/scroll.js'

// Mặc định cho gợn sóng, dùng khi config.js thiếu ô nào. Đúng bằng các con số
// từng hardcode trong shader, nên xoá hẳn PARTICLE.drift thì hình vẫn chạy như cũ.
const DRIFT_DEFAULT = {
  depth: 0.05,
  flat: 0.008,
  scale: 0.7,
  speed: 0.08,
  sway: 0.22,
  swaySpeed: 0.12,
}
const DRIFT = { ...DRIFT_DEFAULT, ...(PARTICLE.drift || {}) }

const vertex = /* glsl */ `
  ${NOISE}

  uniform float uTime;
  uniform float uProgress;   // 0 = hình A, 1 = hình B
  uniform float uSize;
  uniform float uScatter;    // 0..1 — thổi tung hạt (lúc mở thiệp / lúc cuộn nhanh)
  uniform vec2  uPointer;
  uniform float uPixelRatio;

  // gợn sóng — điều khiển từ PARTICLE.drift trong config.js
  uniform float uDriftDepth;
  uniform float uDriftFlat;
  uniform float uDriftScale;
  uniform float uDriftSpeed;

  attribute vec3  aPosA;
  attribute vec3  aPosB;
  attribute float aRnd;
  attribute float aScale;

  varying float vT;
  varying float vRnd;
  varying float vFade;

  void main() {
    // stagger: hạt có aRnd nhỏ đi trước, hạt aRnd lớn đi sau
    float t = clamp((uProgress - aRnd * 0.38) / 0.62, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    vT = t;
    vRnd = aRnd;

    vec3 pos = mix(aPosA, aPosB, t);

    // bulge — mạnh nhất đúng giữa đường bay
    float bulge = sin(t * 3.14159265);
    vec3 curl = curlNoise(pos * 0.7 + vec3(0.0, 0.0, uTime * 0.06));
    pos += curl * bulge * (0.5 + aRnd * 0.55);

    // Gợn sóng: trôi lững lờ khi đứng yên, để hình không bao giờ "chết cứng".
    // Vặn ở PARTICLE.drift trong config.js — ở đó có ghi rõ từng số.
    //
    // ⚠️ Nét chữ ở đây chỉ dày ~0.04 đơn vị, nên biên độ XY (uDriftFlat) phải
    // giữ nhỏ, còn phần "thở" thì dồn vào TRỤC Z (uDriftDepth) — mắt vẫn thấy
    // hạt sống mà đường viền hình giữ nguyên sắc nét.
    //
    // Hệ số nhân theo aRnd giữ đúng khoảng như bản hardcode trước đây:
    //   XY: flat … flat*1.75      (mặc định 0.008 … 0.014)
    //   Z:  depth … depth*2       (mặc định 0.05  … 0.10)
    vec3 drift = curlNoise(pos * uDriftScale + uTime * uDriftSpeed);
    pos.xy += drift.xy * uDriftFlat * (1.0 + 0.75 * aRnd);
    pos.z += drift.z * uDriftDepth * (1.0 + aRnd);

    // thổi tung
    pos += normalize(pos + 0.001) * uScatter * (2.0 + aRnd * 6.0);

    // Parallax theo con trỏ / độ nghiêng máy: cả đám dịch CÙNG một lượng,
    // chỉ chênh nhau theo độ sâu z. Cho mỗi hạt một lượng random riêng thì
    // hình sẽ bị kéo nhoè mỗi lần rê chuột.
    pos.xy += uPointer * (0.1 + pos.z * 0.06);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // tắt hẳn trước khi hạt bay ra tới rìa, để màn khác không dính một lớp bụi mờ
    vFade = 1.0 - clamp(uScatter * 1.25, 0.0, 1.0);
    gl_PointSize = uSize * aScale * (1.0 + bulge * 0.55) * uPixelRatio * (7.0 / -mv.z);
  }
`

const fragment = /* glsl */ `
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform vec3  uColorHot;
  uniform float uOpacity;

  varying float vT;
  varying float vRnd;
  varying float vFade;

  void main() {
    // hạt tròn viền mềm — không dùng texture, đỡ 1 request
    vec2 d = gl_PointCoord - 0.5;
    float r = dot(d, d);
    if (r > 0.25) discard;
    float alpha = smoothstep(0.25, 0.02, r);

    // màu: pha giữa vàng nhạt và vàng đồng theo hạt, lóe sáng lúc đang bay
    vec3 col = mix(uColorA, uColorB, vRnd);
    float hot = sin(vT * 3.14159265);
    col = mix(col, uColorHot, hot * 0.65);

    gl_FragColor = vec4(col, alpha * uOpacity * vFade);
    #include <colorspace_fragment>
  }
`

export default function ParticleMorph({ active = true }) {
  const points = useRef()
  const mat = useRef()
  const [ready, setReady] = useState(false)
  const COUNT = q().particles
  const { viewport } = useThree()

  // Danh sách hình sẽ lần lượt biến hoá
  const shapes = useRef([])
  const state = useRef({ index: 0, progress: 0, hold: 0, scatter: 1 })

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const zeros = new Float32Array(COUNT * 3)
    g.setAttribute('position', new THREE.BufferAttribute(zeros, 3))
    g.setAttribute('aPosA', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3))
    g.setAttribute('aPosB', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3))

    const rnd = new Float32Array(COUNT)
    const scale = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      rnd[i] = Math.random()
      // Vài hạt to hơn hẳn → có "điểm sáng" chứ không phải một mảng đều tăm tắp.
      // Nhưng đừng để to quá: hạt nào rộng hơn nét chữ thì nó sẽ trùm ra ngoài
      // đường viền, và mọi góc chữ đều trông tròn ục, nhoè nhoẹt.
      scale[i] = 0.5 + Math.pow(Math.random(), 4) * 1.3
    }
    g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1))
    g.setAttribute('aScale', new THREE.BufferAttribute(scale, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 14)
    return g
  }, [COUNT])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uSize: { value: 2.2 },
      uScatter: { value: 1 },
      uOpacity: { value: 0.72 },
      uPointer: { value: new THREE.Vector2() },
      uPixelRatio: { value: Math.min(2, window.devicePixelRatio || 1) },
      // giá trị thật được nạp lại mỗi frame trong useFrame, xem DRIFT bên dưới
      uDriftDepth: { value: DRIFT.depth },
      uDriftFlat: { value: DRIFT.flat },
      uDriftScale: { value: DRIFT.scale },
      uDriftSpeed: { value: DRIFT.speed },
      uColorA: { value: new THREE.Color(PALETTE.goldLight) },
      uColorB: { value: new THREE.Color(PALETTE.goldDeep) },
      uColorHot: { value: new THREE.Color(PALETTE.cream) },
    }),
    [],
  )

  // Dựng các hình (chờ webfont để chữ có dấu đúng)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        await waitForFonts()
        if (!alive) return

        // Bề ngang khả dụng ở mặt phẳng z=0 với camera fov 45 đứng ở z≈9.
        // Chữ phải nằm gọn trong đó, nếu không sẽ tràn ra ngoài mép màn hình.
        const aspect = window.innerWidth / window.innerHeight
        const visW = 2 * 9 * Math.tan((45 * Math.PI) / 360) * aspect
        const isNarrow = aspect < 0.95
        // Chữ để lề rộng hơn: chữ dài và mỏng, cụt mất một chữ cái ở mép là hỏng.
        const wide = Math.min(visW * 0.8, 6.4)
        // Hình khối (tim, nhẫn) đối xứng và nằm giữa khung nên dùng được nhiều
        // bề ngang hơn — cần thế, vì CẶP trái tim là bố cục nằm ngang.
        const wideShape = Math.min(visW * 0.9, 7.2)
        const device = isNarrow ? 'mobile' : 'desktop'

        const FONTS = {
          serif: { fontFamily: '"Playfair Display", Georgia, serif', weight: 700 },
          script: { fontFamily: '"Cormorant Garamond", Georgia, serif', weight: 600 },
          // Thư pháp thật. Dùng cho monogram khi muốn CẢ HAI chữ đều thư pháp.
          // ⚠️ Nét mảnh hơn serif khoảng 3 lần (đo được: p10 5px so với 16px),
          // nên chữ sẽ nhạt hơn rõ trên điện thoại (14k hạt). Vẫn liền nét,
          // không đứt thành đốm — chỉ mảnh và mờ hơn.
          calligraphy: { fontFamily: '"Italianno", "Pinyon Script", cursive', weight: 400 },
        }

        // Dịch mỗi mục trong PARTICLE.sequence thành một hàm dựng đám mây điểm
        const builders = PARTICLE.sequence
          .filter((item) => !item.only || item.only === device)
          .map((item) => {
            const k = item.size ?? 1
            switch (item.type) {
              case 'rings':
                // cặp nhẫn lồng nhau trải ngang ~3.5 lần bán kính → cũng phải
                // kẹp bề ngang như cặp trái tim
                return () =>
                  ringsPoints(COUNT, (isNarrow ? 0.9 : 1.05) * k, wideShape * (item.width ?? 1))
              case 'sphere':
                return () => spherePoints(COUNT, (isNarrow ? 1.25 : 1.55) * k)
              case 'text':
                return () =>
                  textPoints(item.text, COUNT, {
                    ...(FONTS[item.font] || FONTS.serif),
                    targetWidth: wide * (item.width ?? 1),
                  })
              case 'monogram':
                // Bỏ trống overlap/heart/style thì destructuring bên shapes.js
                // tự lấy mặc định — không cần lặp lại ở đây.
                return () =>
                  monogramPoints(COUNT, {
                    left: item.left,
                    right: item.right,
                    style: item.style,
                    overlap: item.overlap,
                    heart: item.heart,
                    scriptSize: item.scriptSize,
                    scriptDx: item.scriptDx,
                    scriptDy: item.scriptDy,
                    ...(FONTS[item.font] || FONTS.serif),
                    targetWidth: wideShape * (item.width ?? 1),
                  })
              case 'heart':
              default:
                // đưa cả bề ngang khả dụng: cặp trái tim rộng gần gấp đôi một
                // tim, không kẹp là tràn hai mép trên điện thoại
                return () =>
                  heartPoints(COUNT, (isNarrow ? 2.0 : 2.3) * k, wideShape * (item.width ?? 1))
            }
          })

        // Cần ít nhất 2 hình thì mới có cái để morph qua lại
        if (builders.length === 1) builders.push(builders[0])
        if (!builders.length) return

        // Mỗi hình vài chục nghìn điểm — dựng liền một mạch sẽ chẹn main thread
        // cả giây và làm khựng khung hình đầu. Nhả luồng giữa từng hình.
        const yieldToUi = () => new Promise((r) => setTimeout(r, 0))

        const list = []
        for (const build of builders) {
          if (!alive) return
          list.push(build())
          // hai hình đầu là đủ để bắt đầu chạy, phần còn lại dựng nền
          if (list.length === 2) {
            const g = points.current.geometry
            g.attributes.aPosA.array.set(list[0])
            g.attributes.aPosB.array.set(list[1])
            g.attributes.aPosA.needsUpdate = true
            g.attributes.aPosB.needsUpdate = true
            shapes.current = list
            setReady(true)
          }
          await yieldToUi()
        }
        if (!alive) return
        shapes.current = list
      } catch (err) {
        console.error('[ParticleMorph] dựng hình thất bại:', err)
      }
    })()
    return () => {
      alive = false
    }
  }, [COUNT])

  useFrame((_, dt) => {
    const u = mat.current?.uniforms
    if (!u) return
    const d = Math.min(dt, 0.05)
    u.uTime.value += d

    // fade-in lúc vào trang: hạt từ xa tụ về.
    // damp theo dt chứ không theo frame — máy 120Hz và máy 30fps phải giống nhau.
    const s = state.current
    const target = active ? 0 : 1
    s.scatter = THREE.MathUtils.damp(s.scatter, target, active ? 1.6 : 2.2, d)
    u.uScatter.value = s.scatter

    u.uPointer.value.set(scrollState.pointerSmooth.x, scrollState.pointerSmooth.y)

    // Đọc lại gợn sóng MỖI FRAME, không nhét vào useMemo: nhờ vậy sửa
    // PARTICLE.drift trong config.js là thấy đổi ngay, khỏi reload. Chỉ là gán
    // vài số float nên không tốn gì.
    const w = PARTICLE.drift || DRIFT
    u.uDriftDepth.value = w.depth ?? DRIFT.depth
    u.uDriftFlat.value = w.flat ?? DRIFT.flat
    u.uDriftScale.value = w.scale ?? DRIFT.scale
    u.uDriftSpeed.value = w.speed ?? DRIFT.speed

    if (!ready || !active) return

    // Vòng lặp: giữ hình → morph → sang hình kế (nhịp đặt trong config)
    s.hold += d
    if (s.hold > PARTICLE.hold) {
      s.progress = Math.min(1, s.progress + d / Math.max(0.2, PARTICLE.morph))
      if (s.progress >= 1) {
        // chốt hình B thành hình A mới, nạp hình kế tiếp vào B
        const list = shapes.current
        s.index = (s.index + 1) % list.length
        const g = points.current.geometry
        g.attributes.aPosA.array.set(list[s.index])
        g.attributes.aPosB.array.set(list[(s.index + 1) % list.length])
        g.attributes.aPosA.needsUpdate = true
        g.attributes.aPosB.needsUpdate = true
        s.progress = 0
        s.hold = 0
      }
    }
    u.uProgress.value = s.progress

    // xoay chậm, và né theo con trỏ một chút
    const p = points.current
    // Lắc cả cụm — chuyển động RIÊNG, không phải gợn sóng (PARTICLE.drift.sway)
    const sway = w.sway ?? DRIFT.sway
    p.rotation.y =
      Math.sin(u.uTime.value * (w.swaySpeed ?? DRIFT.swaySpeed)) * sway +
      scrollState.pointerSmooth.x * 0.12
    p.rotation.x = scrollState.pointerSmooth.y * -0.08

    // Nâng cụm hạt lên nửa trên khung hình — nửa dưới dành cho tên cô dâu chú rể,
    // đúng bố cục poster: hình ở trên, chữ vàng ở dưới.
    const narrow = viewport.width < viewport.height
    p.position.y = viewport.height * (narrow ? 0.26 : 0.23)
  })

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
