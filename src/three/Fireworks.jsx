// Pháo hoa mừng khách vừa gửi hồi âm thành công.
//
// Nằm chung canvas với mọi thứ khác — thêm một <Canvas> nữa là thêm một WebGL
// context, điện thoại không gánh nổi. Bloom ở Stage.jsx lo sẵn phần quầng sáng,
// ở đây chỉ cần vẽ chấm sáng cho đúng chỗ.
//
// Cách hoạt động: cấp phát sẵn SHELLS quả × sparks tia, dùng theo vòng tròn.
// Lúc bắn, CPU ghi một lần vào attribute của đúng quả đó (tâm nổ, giờ sinh,
// hướng mỗi tia) rồi thôi. Toàn bộ đường bay là công thức trong vertex shader,
// nên mỗi frame CPU không phải đụng vào gì — chỉ cộng thêm dt vào uTime.
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../config.js'
import { q } from '../lib/quality.js'
import { burstQueue } from '../lib/burst.js'

// Bao nhiêu quả được phép cùng sáng trên trời. Quá số này thì quả mới ghi đè
// quả cũ nhất — hết sạch cũng chỉ tốn bấy nhiêu bộ nhớ.
const SHELLS = 10

const RISE = 0.55 // giây bay lên trước khi nổ
const LIFE = 2.3 // giây tàn dần sau khi nổ
const CLIMB = 2.6 // quãng đường bay lên, đơn vị thế giới

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSpeed;   // vận tốc tia lúc vừa nổ
  uniform float uDrag;    // hệ số cản không khí
  uniform float uGravity;

  attribute vec3  aDir;     // hướng bay của tia (đã gồm cả độ dài ngẫu nhiên)
  attribute vec3  aOrigin;  // tâm nổ
  attribute float aBirth;   // thời điểm châm ngòi
  attribute float aRnd;
  attribute float aTone;

  varying float vAlpha;
  varying float vRnd;
  varying float vTone;

  const float RISE = ${RISE.toFixed(2)};
  const float LIFE = ${LIFE.toFixed(2)};
  const float CLIMB = ${CLIMB.toFixed(2)};

  void hide() {
    // Ném ra ngoài khối clip → GPU vứt luôn, không tốn một pixel nào.
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
  }

  void main() {
    vRnd = aRnd;
    vTone = aTone;

    float age = uTime - aBirth;
    // aBirth < 0 là chỗ chưa dùng tới; age < 0 là quả đã xếp hàng nhưng chưa tới giờ
    if (aBirth < 0.0 || age < 0.0 || age > RISE + LIFE) { hide(); return; }

    vec3 pos;
    float psize;

    if (age < RISE) {
      // --- đang bay lên ---
      // Chỉ một NHÚM tia làm đuôi lửa. Cho cả mấy trăm tia chụm một chỗ thì
      // blending cộng dồn lại thành một cục trắng to đùng, chứ không ra vệt sáng.
      if (aRnd > 0.06) { hide(); return; }

      float tail = aRnd / 0.06;                       // 0 = đầu mũi, 1 = cuối đuôi
      float t = clamp((age - tail * 0.09) / RISE, 0.0, 1.0);
      float e = 1.0 - pow(1.0 - t, 2.2);              // chậm dần khi gần tới đỉnh
      pos = aOrigin - vec3(0.0, CLIMB * (1.0 - e), 0.0);
      pos.x += sin(age * 11.0 + aRnd * 90.0) * 0.015; // rung nhẹ cho đỡ cứng

      vAlpha = (1.0 - tail * 0.75) * 0.7 * smoothstep(0.0, 0.07, age);
      psize = 2.4;
    } else {
      // --- đã nổ ---
      float e = age - RISE;

      // Tích phân của vận tốc suy giảm theo hàm mũ: v(t) = v0·e^(−kt).
      // Nhờ vậy tia bắn ra rất nhanh rồi khựng lại lơ lửng — đúng nhịp pháo thật,
      // khác hẳn kiểu bay đều tay tuyến tính.
      float travel = (1.0 - exp(-uDrag * e)) / uDrag;
      pos = aOrigin + aDir * (uSpeed * travel);
      pos.y -= 0.5 * uGravity * e * e;

      float life = e / LIFE;
      float flicker = 0.55 + 0.45 * sin(e * 24.0 + aRnd * 60.0);
      // ramp 0.05s đầu: nếu để bùng ngay ở full alpha thì vài trăm tia còn chồng
      // lên nhau đúng một điểm, cháy trắng cả khung hình mất một hai frame
      vAlpha = pow(1.0 - life, 1.6) * flicker * smoothstep(0.0, 0.05, e);
      psize = 3.2 * (1.0 - life * 0.45);
    }

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = psize * uPixelRatio * (7.0 / -mv.z) * (0.7 + aRnd * 0.6);
  }
`

const fragment = /* glsl */ `
  uniform vec3  uWarm;
  uniform vec3  uCool;
  uniform vec3  uRose;
  uniform float uOpacity;

  varying float vAlpha;
  varying float vRnd;
  varying float vTone;

  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;

    // lõi đặc + quầng mềm — quầng mới là thứ khiến nó ra "tàn lửa" chứ không
    // phải một chấm tròn dán lên trời
    float core = smoothstep(0.2, 0.0, r);
    float halo = smoothstep(0.5, 0.06, r) * 0.3;

    // Giữ trong hệ màu của tấm thiệp: vàng nắng → vàng kem, điểm chút hồng
    // cánh sen. Pháo hoa bảy sắc cầu vồng sẽ chửi nhau với cả trang.
    vec3 col = mix(uWarm, uCool, vRnd);
    col = mix(col, uRose, vTone * 0.7);

    gl_FragColor = vec4(col, (core + halo) * vAlpha * uOpacity);
    #include <colorspace_fragment>
  }
`

export default function Fireworks() {
  const points = useRef()
  const mat = useRef()
  const { viewport } = useThree()
  const SPARKS = q().sparks
  const TOTAL = SHELLS * SPARKS

  // time  — đồng hồ riêng, khớp với uTime trong shader
  // slot  — quả kế tiếp sẽ dùng (vòng tròn)
  // until — thời điểm quả cuối cùng tắt hẳn; sau lúc đó thì ẩn cả object đi
  const state = useRef({ time: 0, slot: 0, until: -1 })

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    // `position` không dùng tới (mọi thứ tính từ aOrigin + aDir) nhưng three vẫn
    // đòi có, để còn biết số đỉnh cần vẽ.
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TOTAL * 3), 3))
    g.setAttribute('aDir', new THREE.BufferAttribute(new Float32Array(TOTAL * 3), 3))
    g.setAttribute('aOrigin', new THREE.BufferAttribute(new Float32Array(TOTAL * 3), 3))
    g.setAttribute('aTone', new THREE.BufferAttribute(new Float32Array(TOTAL), 1))

    // −1 = ô trống. Không có cái này thì lúc mới vào trang cả TOTAL điểm đều
    // mang aBirth = 0 và sẽ đồng loạt nổ ngay giây đầu tiên.
    const birth = new Float32Array(TOTAL).fill(-1)
    g.setAttribute('aBirth', new THREE.BufferAttribute(birth, 1))

    const rnd = new Float32Array(TOTAL)
    for (let i = 0; i < TOTAL; i++) rnd[i] = Math.random()
    g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1))

    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30)
    return g
  }, [TOTAL])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(2, window.devicePixelRatio || 1) },
      uSpeed: { value: 4.4 },
      uDrag: { value: 2.6 },
      uGravity: { value: 1.15 },
      uOpacity: { value: 0.95 },
      uWarm: { value: new THREE.Color(PALETTE.sun) },
      uCool: { value: new THREE.Color(PALETTE.goldLight) },
      uRose: { value: new THREE.Color(PALETTE.petal) },
    }),
    [],
  )

  // Nạp một quả vào buffer. Chỉ chạy đúng một lần cho mỗi quả pháo.
  const launch = (req) => {
    const s = state.current
    const g = geometry
    const dir = g.attributes.aDir.array
    const org = g.attributes.aOrigin.array
    const birth = g.attributes.aBirth.array
    const tone = g.attributes.aTone.array

    const slot = s.slot++ % SHELLS
    const base = slot * SPARKS
    const at = s.time + (req.delay || 0)

    // Khung nhìn ở mặt phẳng z=0. Màn dọc thì bề ngang hẹp lắm (~3.4 đơn vị) và
    // tấm thiệp chiếm gần hết, nên đẩy pháo lên cao hơn để còn thấy.
    const narrow = viewport.width < viewport.height
    const ny = narrow ? 0.4 + req.ny * 0.55 : req.ny
    const x = (req.nx * viewport.width) / 2
    const y = (ny * viewport.height) / 2
    const z = (Math.random() - 0.5) * 2.5 - 1

    for (let i = 0; i < SPARKS; i++) {
      const j = base + i

      // Hướng đều trên mặt cầu. Bóp trục Z còn 0.85 để quả pháo trải ra ngang
      // tầm mắt nhiều hơn là đâm thẳng vào ống kính.
      const u = Math.random() * 2 - 1
      const th = Math.random() * Math.PI * 2
      const sr = Math.sqrt(1 - u * u)
      // Dồn tia ra gần vỏ ngoài (0.74..1) — pháo thật là một lớp vỏ cầu, rắc
      // đều cả trong ruột thì nhìn ra quả bóng đặc, mất hẳn cái vành sáng.
      const m = 0.74 + Math.random() * 0.26

      dir[j * 3] = sr * Math.cos(th) * m
      dir[j * 3 + 1] = u * m
      dir[j * 3 + 2] = sr * Math.sin(th) * m * 0.85

      org[j * 3] = x
      org[j * 3 + 1] = y
      org[j * 3 + 2] = z

      birth[j] = at
      tone[j] = req.tone || 0
    }

    g.attributes.aDir.needsUpdate = true
    g.attributes.aOrigin.needsUpdate = true
    g.attributes.aBirth.needsUpdate = true
    g.attributes.aTone.needsUpdate = true

    s.until = Math.max(s.until, at + RISE + LIFE)
  }

  useFrame((_, dt) => {
    const u = mat.current?.uniforms
    const p = points.current
    if (!u || !p) return

    const s = state.current
    s.time += Math.min(dt, 0.05)
    u.uTime.value = s.time

    while (burstQueue.length) launch(burstQueue.shift())

    // Không có quả nào đang cháy thì tắt hẳn object — khỏi tốn một lệnh vẽ nào
    // trong suốt phần đời còn lại của trang.
    p.visible = s.time < s.until
  })

  return (
    <points ref={points} geometry={geometry} frustumCulled={false} visible={false}>
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
