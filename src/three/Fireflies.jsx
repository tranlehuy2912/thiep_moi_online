// T8 — Bụi sáng / đom đóm. Points + curl noise + nhấp nháy lệch pha.
// Rẻ gần như miễn phí nhưng lấp đầy không gian, cảnh trông "có không khí" hẳn.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { NOISE } from './shaders/noise.glsl.js'
import { PALETTE } from '../config.js'
import { q } from '../lib/quality.js'
import { scrollState } from '../lib/scroll.js'

const vertex = /* glsl */ `
  ${NOISE}
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec2  uPointer;
  attribute float aRnd;
  attribute float aSize;
  varying float vTwinkle;
  varying float vRnd;

  void main() {
    vec3 pos = position;
    pos += curlNoise(pos * 0.22 + uTime * 0.035) * (0.9 + aRnd * 1.6);
    pos.y += sin(uTime * 0.35 + aRnd * 12.0) * 0.35;
    pos.xy += uPointer * (0.25 + aRnd * 0.5);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    vTwinkle = 0.25 + 0.55 * pow(0.5 + 0.5 * sin(uTime * (0.8 + aRnd * 2.4) + aRnd * 30.0), 2.0);
    vRnd = aRnd;
    gl_PointSize = aSize * uPixelRatio * (7.0 / -mv.z) * (0.6 + vTwinkle * 0.7);
  }
`

const fragment = /* glsl */ `
  uniform vec3 uWarm;
  uniform vec3 uCool;
  varying float vTwinkle;
  varying float vRnd;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    // lõi sáng + quầng mềm
    float core = smoothstep(0.18, 0.0, r);
    float halo = smoothstep(0.5, 0.05, r) * 0.22;
    vec3 col = mix(uWarm, uCool, vRnd);
    gl_FragColor = vec4(col, (core + halo) * vTwinkle * 0.55);
    #include <colorspace_fragment>
  }
`

export default function Fireflies({ count = q().fireflies }) {
  const mat = useRef()

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const rnd = new Float32Array(count)
    const size = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 22
      pos[i * 3 + 1] = (Math.random() - 0.5) * 14
      pos[i * 3 + 2] = (Math.random() - 0.5) * 14 - 3
      rnd[i] = Math.random()
      size[i] = 1.0 + Math.pow(Math.random(), 2.5) * 4.0
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 24)
    return g
  }, [count])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(2, window.devicePixelRatio || 1) },
      uPointer: { value: new THREE.Vector2() },
      uWarm: { value: new THREE.Color(PALETTE.sun) },
      uCool: { value: new THREE.Color(PALETTE.goldLight) },
    }),
    [],
  )

  useFrame((_, dt) => {
    const u = mat.current?.uniforms
    if (!u) return
    u.uTime.value += Math.min(dt, 0.05)
    u.uPointer.value.set(scrollState.pointerSmooth.x, scrollState.pointerSmooth.y)
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
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
