// Nền trời hoàng hôn kiểu poster: xanh navy sâu ở trên, chuyển sang vàng nắng ở giữa,
// có mây cuộn (fbm) và quầng sáng mặt trời. Toàn bộ là 1 mặt phẳng + fragment shader,
// nặng 0 byte asset.
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { NOISE } from './shaders/noise.glsl.js'
import { PALETTE } from '../config.js'
import { scrollState } from '../lib/scroll.js'

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.999, 1.0); // dán chặt vào mặt phẳng xa
  }
`

const fragment = /* glsl */ `
  ${NOISE}
  uniform float uTime;
  uniform float uScroll;
  uniform float uCalm;
  uniform vec2  uPointer;
  uniform float uAspect;
  uniform vec3  uDeep;
  uniform vec3  uMid;
  uniform vec3  uWarm;
  uniform vec3  uSun;
  varying vec2 vUv;

  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * snoise(p); p *= 2.02; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);

    // trục dọc chạy theo scroll → cuộn trang là bầu trời đổi giờ
    float h = uv.y + uScroll * 0.2;

    // Nền phải TỐI. Vàng của hạt là chất additive — nền sáng một chút là cháy trắng ngay.
    vec3 col = mix(uDeep, uMid, smoothstep(0.0, 0.6, h));
    col = mix(col, uDeep * 0.85, smoothstep(0.6, 1.05, h));

    // Mặt trời trôi sang trái và lên cao theo scroll, đồng thời DỊU HẲN ở màn
    // album (uCalm). Bloom là hiệu ứng màn hình: quầng nắng dù nằm phía sau
    // ảnh vẫn loang lên trên mặt ảnh và làm ảnh bạc trắng.
    vec2 sunPos = vec2(0.04 - uScroll * 0.5, 0.22 - uScroll * 0.45) + uPointer * 0.03;
    float dSun = length(p - sunPos);
    float glow = exp(-dSun * 2.6) * 0.7 + exp(-dSun * 7.5) * 0.5;
    col += uSun * glow * 0.34 * (1.0 - uScroll * 0.55) * (1.0 - uCalm * 0.8);

    // mây cuộn
    float clouds = fbm(vec3(p * 1.9 + vec2(uTime * 0.012, -uTime * 0.006), uTime * 0.02));
    clouds = smoothstep(0.2, 1.0, clouds);
    float cloudMask = smoothstep(1.0, 0.35, h) * (0.22 - uScroll * 0.16) * (1.0 - uCalm * 0.7);
    col = mix(col, mix(uWarm, uSun, 0.7), clouds * cloudMask);

    // tia nắng toả (god rays kiểu 2D, rẻ hơn volumetric thật rất nhiều).
    // Tần số cao + biên độ thấp: gợi ý ánh sáng chứ không vẽ hẳn hình ngôi sao.
    vec2 d = p - sunPos;
    float ang = atan(d.y, d.x);
    float rays = fbm(vec3(ang * 7.0, length(d) * 0.4 - uTime * 0.04, 0.0));
    rays = smoothstep(0.3, 1.0, rays) * exp(-length(d) * 2.0);
    col += uSun * rays * 0.07 * (1.0 - uScroll * 0.7) * (1.0 - uCalm);

    // vignette — mạnh tay, đây là thứ giữ cho chữ ở giữa đọc được
    float r = length((uv - 0.5) * vec2(uAspect, 1.0));
    col *= 1.0 - smoothstep(0.28, 1.05, r) * 0.85;

    // grain — làm cảnh bớt "CGI", giống ảnh chụp phim
    float g = fract(sin(dot(uv * 1024.0, vec2(12.9898, 78.233)) + uTime) * 43758.5453);
    col += (g - 0.5) * 0.018;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

// `calm` = true khi màn đang xem lấy hình ảnh làm nội dung chính (album).
// Lúc đó nền phải nhường sân: hạ quầng nắng, tia sáng và mây.
export default function Backdrop({ calm = false }) {
  const mat = useRef()
  const { size } = useThree()

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uCalm: { value: 0 },
      uPointer: { value: new THREE.Vector2() },
      uAspect: { value: 1 },
      uDeep: { value: new THREE.Color(PALETTE.skyDeep) },
      uMid: { value: new THREE.Color(PALETTE.skyMid) },
      uWarm: { value: new THREE.Color(PALETTE.skyWarm) },
      uSun: { value: new THREE.Color(PALETTE.sun) },
    }),
    [],
  )

  useFrame((_, dt) => {
    const u = mat.current?.uniforms
    if (!u) return
    const d = Math.min(dt, 0.05)
    u.uTime.value += d
    u.uScroll.value = scrollState.smooth
    // chuyển dịu/không dịu bằng damp để không thấy nền "nhảy" khi đổi màn
    u.uCalm.value = THREE.MathUtils.damp(u.uCalm.value, calm ? 1 : 0, 3, d)
    u.uAspect.value = size.width / size.height
    u.uPointer.value.set(scrollState.pointerSmooth.x, scrollState.pointerSmooth.y)
  })

  return (
    <mesh frustumCulled={false} renderOrder={-100}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}
