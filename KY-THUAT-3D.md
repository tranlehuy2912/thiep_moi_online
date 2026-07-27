# Catalog kỹ thuật 3D cho thiệp cưới

Xếp theo nhóm. Mỗi kỹ thuật có: **Wow** (độ ấn tượng) / **Cost** (chi phí làm + hiệu năng) /
**Mobile** (chạy được trên điện thoại không).

Bảng chọn nhanh — nếu chỉ làm 5 cái, tôi chọn: **T1, T2, T11, T6, T5**.

| ID | Kỹ thuật | Wow | Cost | Mobile |
|---|---|---|---|---|
| T1 | Particle Morphing (mesh→mesh) | ★★★★★ | ★★★ | ✅ |
| T2 | Text → Particle (tên, ngày) | ★★★★★ | ★★ | ✅ |
| T3 | Photo → Particle explosion | ★★★★ | ★★★ | ✅ |
| T4 | Camera path scrollytelling | ★★★★ | ★★ | ✅ |
| T5 | Nhẫn thuỷ tinh / refraction | ★★★★ | ★★ | ⚠️ |
| T6 | Cánh hoa rơi (instanced + curl noise) | ★★★ | ★ | ✅ |
| T7 | Dissolve / burn transition shader | ★★★★ | ★★ | ✅ |
| T8 | Đom đóm, bụi sáng, volumetric light | ★★★ | ★ | ✅ |
| T9 | Raymarched SDF heart / nền procedural | ★★★★ | ★★★★ | ⚠️ |
| T10 | Mở bao thư / gấp thiệp 3D | ★★★★ | ★★★ | ✅ |
| T11 | Ảnh 2.5D depth-map parallax | ★★★★★ | ★ | ✅ |
| T12 | Album cong / infinite bend gallery | ★★★★ | ★★★ | ✅ |
| T13 | Gooey / liquid image reveal | ★★★ | ★★ | ✅ |
| T14 | Sàn phản chiếu + caustics nước | ★★★ | ★★ | ⚠️ |
| T15 | Pháo giấy / confetti tương tác | ★★★ | ★★ | ✅ |
| T16 | GPGPU 1 triệu hạt (FBO) | ★★★★★ | ★★★★★ | ❌ |
| T17 | Gaussian Splatting địa điểm thật | ★★★★★ | ★★★★ | ⚠️ |
| T18 | Metaball / marching cubes trái tim | ★★★ | ★★★★ | ❌ |

---

## NHÓM A — Hạt (particles). Đây là linh hồn của thiệp.

### T1. 3D Particle Morphing — hình này biến thành hình kia ⭐
Ý tưởng: **một** hệ hạt duy nhất, mỗi hạt biết vị trí của nó ở *mọi* hình. Morph = nội suy
trong vertex shader → cực nhẹ vì CPU không làm gì cả.

Chuỗi cho thiệp cưới: `2 trái tim → đôi nhẫn lồng nhau → chữ tên → ngày cưới → bó hoa`.

Cách lấy điểm từ mesh:

```js
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'

function samplePoints(mesh, count) {
  const sampler = new MeshSurfaceSampler(mesh).build()
  const arr = new Float32Array(count * 3)
  const p = new THREE.Vector3()
  for (let i = 0; i < count; i++) {
    sampler.sample(p)
    arr.set([p.x, p.y, p.z], i * 3)
  }
  return arr
}
```

Vertex shader — điểm quan trọng là **stagger** (mỗi hạt bay lệch pha) và **bulge** (phình ra
giữa đường bay), thiếu 2 cái này thì morph trông như trượt phẳng, rất rẻ tiền:

```glsl
uniform float uProgress;   // 0 → 1
attribute vec3  aPosA;
attribute vec3  aPosB;
attribute float aRnd;      // 0..1, random mỗi hạt

void main() {
  // stagger: hạt có aRnd nhỏ bay trước
  float t = clamp((uProgress - aRnd * 0.35) / 0.65, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);                  // smoothstep

  vec3 pos = mix(aPosA, aPosB, t);

  // bulge: phình theo curl noise, mạnh nhất ở giữa đường bay
  float bulge = sin(t * 3.14159);
  pos += curlNoise(pos * 0.6 + uTime * 0.05) * bulge * 0.9;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = uSize * (1.0 + bulge * 0.6) / -mv.z;
  gl_Position = projectionMatrix * mv;
}
```

Fragment: vẽ hạt tròn mềm + màu gradient theo tiến độ.

```glsl
float d = length(gl_PointCoord - 0.5);
float a = smoothstep(0.5, 0.15, d);
gl_FragColor = vec4(mix(uColorA, uColorB, t), a);
```

Setup: `blending: AdditiveBlending`, `depthWrite: false`, `transparent: true` + Bloom.
Trái tim: dùng `THREE.Shape` + `ExtrudeGeometry` từ đường bezier tim (không cần model ngoài).

**Chi phí:** 30k–120k hạt = 1 draw call. Chạy 60fps cả trên điện thoại.

### T2. Text → Particle — hiện tên cô dâu chú rể bằng hạt ⭐
Không dùng `TextGeometry` (vấn đề font dấu tiếng Việt + nặng). Vẽ chữ ra canvas 2D rồi
scan pixel:

```js
function textToPoints(text, { font = '700 200px "Playfair Display"', density = 4 } = {}) {
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  ctx.font = font
  const w = Math.ceil(ctx.measureText(text).width) + 40
  c.width = w; c.height = 260
  ctx.font = font; ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'
  ctx.fillText(text, 20, 130)                    // "Huy ❤ Ngân" — dấu OK vì là canvas

  const { data } = ctx.getImageData(0, 0, c.width, c.height)
  const pts = []
  for (let y = 0; y < c.height; y += density)
    for (let x = 0; x < c.width; x += density)
      if (data[(y * c.width + x) * 4 + 3] > 128)
        pts.push(
          (x - c.width / 2) * 0.02,
          -(y - c.height / 2) * 0.02,
          (Math.random() - 0.5) * 0.15          // dày nhẹ theo Z cho có khối
        )
  return new Float32Array(pts)
}
```

Vì số hạt của mỗi hình khác nhau → chọn `COUNT` cố định rồi **lấy modulo** khi nhồi attribute:
`arr[i] = pts[(i % n)]`. Cách này an toàn và luôn phủ kín hình.

### T3. Photo → Particle explosion
Mỗi hạt = 1 pixel của ảnh: vị trí từ lưới UV, màu lấy từ texture trong vertex shader
(`texture2D` trong vertex cần `vertexShader` sampling — hỗ trợ tốt ở WebGL2). Khi đổi ảnh:
hạt nổ ra theo hướng normal + noise, rồi tụ lại thành ảnh mới. Dùng cho chuyển ảnh trong album.

Biến thể rẻ hơn nhiều: `InstancedMesh` các tấm nhỏ (mỗi tấm 1 ô của ảnh) bay/xoay về vị trí —
trông như ảnh vỡ thành ngàn mảnh giấy, rất hợp không khí cưới.

### T6. Cánh hoa rơi / hoa giấy — instanced + curl noise
2000 cánh hoa `InstancedMesh` (geometry = 1 plane bẻ cong nhẹ). Không dùng physics:

```js
// mỗi instance có seed riêng; toàn bộ chuyển động tính bằng hàm thuần theo time
const y = mod(seed.y - t * speed, height)                  // rơi + wrap vô hạn
const x = seed.x + sin(t * 0.6 + seed.phase) * 0.8         // đưa qua đưa lại
const rot = t * seed.spin                                   // xoay lật
```

Rẻ, đẹp, chạy mọi máy. Nên có ở section cuối.

### T8. Đom đóm / bụi sáng bay + volumetric light
`Points` với sprite glow, chuyển động curl noise chậm, `AdditiveBlending` + Bloom. Thêm
2–3 mặt phẳng "tia sáng" (plane với gradient alpha, luôn hướng camera) → cảm giác nắng
xuyên qua tán cây. Cực rẻ, tăng chất lượng cảm nhận rõ rệt.

### T15. Pháo giấy tương tác
Click/tap bất kỳ đâu → burst confetti tại điểm đó (raycast lên plane ở z=0). Dùng chung
InstancedMesh với pool 500 mảnh, mỗi burst kích hoạt 80 mảnh có `birthTime`. Kết hợp với
nút "Chúc mừng!" ở section RSVP.

### T16. GPGPU — 1 triệu hạt (chỉ desktop)
`GPUComputationRenderer` (three/examples/jsm/misc/GPUComputationRenderer.js): lưu
position/velocity vào 2 float texture, cập nhật bằng fragment shader → hạt có *vật lý thật*:
hút về hình đích, đẩy khỏi con trỏ chuột, có ma sát.

```
positionTex ─┐
             ├─ velocity shader: v += (target - p) * k - v * damping + repel(mouse)
velocityTex ─┘
             └─ position shader:  p += v * dt
```

**Cảnh báo:** cần `EXT_color_buffer_float`; iOS Safari cũ fail. Chỉ bật khi `quality === 'high'`
và extension tồn tại. Đây là "phiên bản xịn" của T1 — làm sau, khi mọi thứ khác đã xong.

---

## NHÓM B — Ảnh & album (phần khách xem lâu nhất, đừng coi nhẹ)

### T11. Ảnh 2.5D depth-map parallax ⭐ — tỉ lệ wow/công sức cao nhất toàn bộ danh sách
1 ảnh cưới + 1 depth map (grayscale) → ảnh có chiều sâu thật, nghiêng theo con trỏ/gyroscope.
Chỉ là 1 plane + shader 10 dòng:

```glsl
uniform sampler2D uTex, uDepth;
uniform vec2 uMouse;      // -1..1
void main() {
  float depth = texture2D(uDepth, vUv).r;
  vec2 offset = uMouse * (depth - 0.5) * 0.06;
  gl_FragColor = texture2D(uTex, vUv + offset);
}
```

Depth map lấy từ: Depth-Anything V2 (miễn phí, chạy local hoặc HuggingFace Space), hoặc ảnh
Portrait mode của iPhone (đã có depth sẵn). Tô tay bằng Photoshop cũng được — 5 phút/ảnh.
Dùng cho 3–4 ảnh đắt nhất ở section "chuyện tình".

Nâng cấp: `MeshPlaneGeometry` phân đoạn cao + **displace vertex theo depth** → parallax thật
sự có khối (không bị "trượt texture"), thêm chút inpainting ở rìa.

### T12. Album cong / infinite bend gallery
Dãy plane xếp ngang, drag để cuộn, vertex shader bẻ cong theo khoảng cách tới tâm:

```glsl
pos.z -= abs(pos.x + uScroll) * 0.25;              // cong về sau ở 2 mép
pos.y += sin((pos.x + uScroll) * 0.4) * 0.1;       // sóng nhẹ
```
Thêm **inertia + snap**: `velocity *= 0.92`, thả tay thì hút về ảnh gần nhất. Và
**RGB shift theo tốc độ cuộn** (`uv.r` lệch nhẹ theo `velocity`) → cảm giác "tốc độ" rất đắt.

### T13. Gooey / liquid image reveal
Chuyển giữa 2 ảnh bằng noise threshold thay vì fade:

```glsl
float n = texture2D(uNoise, vUv * 1.5).r;
float m = smoothstep(uProgress - 0.15, uProgress + 0.15, n);
gl_FragColor = mix(texture2D(uTexA, vUv), texture2D(uTexB, vUv), m);
```
Đổi `uNoise` thành ảnh "mực loang" hoặc "vệt cọ" → chuyển ảnh như vẽ màu nước. Rất hợp
tông thiệp cưới.

### T7. Dissolve / burn — dùng cho niêm phong sáp & chuyển section
Cùng ý tưởng threshold noise nhưng có **viền cháy phát sáng**:

```glsl
float n = noise(vPos * 8.0);
if (n < uCut) discard;                                    // tan biến
float edge = smoothstep(uCut, uCut + 0.06, n);
vec3 col = mix(uEdgeColor * 3.0, baseColor, edge);        // rìa sáng rực
```
Dùng để: gỡ niêm phong sáp lúc mở thiệp, chữ hiện ra từ hư không, chuyển giữa các cảnh.

---

## NHÓM C — Vật thể & vật liệu

### T5. Nhẫn cưới thuỷ tinh / kim cương — refraction
```jsx
<mesh>
  <torusGeometry args={[1, 0.28, 64, 128]} />
  <MeshTransmissionMaterial
    thickness={0.6} roughness={0.05} ior={1.6}
    chromaticAberration={0.4} anisotropy={0.3}
    backside samples={6}
  />
</mesh>
```
Cần `<Environment preset="sunset" />` (hoặc HDR nhẹ 512px) để có gì mà khúc xạ.
⚠️ `MeshTransmissionMaterial` render scene nhiều lần → nặng. Trên mobile: `samples={2}`,
`backside={false}`, hoặc thay bằng `MeshPhysicalMaterial` + envMap + Fresnel giả:

```glsl
float fresnel = pow(1.0 - dot(vNormal, viewDir), 3.0);
col += fresnel * uRimColor * 1.5;
```

Nhẫn nên tạo bằng `TorusGeometry`/`LatheGeometry` — 0 byte tải về.

### T14. Sàn phản chiếu + caustics nước
`<MeshReflectorMaterial blur={[300,100]} mixBlur={1} mixStrength={40} />` của drei → sàn đá
bóng phản chiếu hạt và chữ, làm cảnh sang lên hẳn. Caustics: 1 texture caustics tile +
2 lớp UV trôi ngược nhau, additive → vệt sáng nước lung linh trên sàn/tường.

### T9. Raymarched SDF — trái tim procedural, nền gradient sống
Chỉ 1 fullscreen quad, toàn bộ hình học trong fragment shader. Ưu điểm: **0 byte asset**,
morph giữa các hình bằng `smin()` mượt như chất lỏng.

```glsl
float sdHeart(vec3 p) { /* … */ }
float sdRing(vec3 p)  { /* torus */ }
float map(vec3 p) {
  return mix(sdHeart(p), sdRing(p), uMorph);   // hoặc smin() để chảy vào nhau
}
```
⚠️ Fill-rate cực nặng trên mobile → render ở **half resolution** rồi upscale, và giới hạn
`MAX_STEPS = 48`. Dùng cho **nền** (soft gradient + mesh gradient kiểu Shadergradient) thì
rẻ và luôn đẹp; dùng cho vật thể chính thì cân nhắc.

### T18. Metaball / marching cubes
2 giọt nước tròn trôi vào nhau, dính lại thành trái tim — ẩn dụ đẹp cho "hai người thành một".
Marching cubes trên CPU rất nặng; nếu làm thì làm bằng raymarched `smin()` (T9) — cùng kết quả,
nhẹ hơn nhiều.

### T17. Gaussian Splatting địa điểm thật
Quay ~200 ảnh nhà thờ/nhà hàng bằng điện thoại → train splat (Luma AI / Postshot) →
render bằng `@lumaai/luma-web` hoặc `gsplat.js`. Khách được "đứng trong" địa điểm thật.
Cực wow nhưng file 20–60MB → chỉ nên làm nếu chấp nhận tải riêng khi khách bấm "Xem địa điểm".

---

## NHÓM D — Camera, chuyển cảnh, mở thiệp

### T4. Camera path scrollytelling ⭐
Camera bay trên đường cong, scroll = tiến độ trên đường cong. Đây là "chất keo" nối các section.

```js
const path = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 1.4,  8),   // hero
  new THREE.Vector3(-3, 1.0, 3),   // save the date
  new THREE.Vector3(2, 0.8, -2),   // chuyện tình
  new THREE.Vector3(0, 1.2, -8),   // album
])
useFrame(() => {
  const t = scrollProgress.current            // 0..1 từ ScrollTrigger/Lenis
  path.getPointAt(t, camera.position)
  camera.lookAt(lookTargets.getPointAt(t, tmp))   // curve thứ 2 cho hướng nhìn
})
```
Mẹo: **luôn dùng 2 curve** (một cho vị trí, một cho điểm nhìn) — dùng `getTangent` sẽ khiến
camera lắc và say. Thêm damping (`MathUtils.damp`) để scroll giật không làm camera giật.

### T10. Mở bao thư / gấp thiệp 3D
Không cần model: 5 plane với **hierarchy pivot đúng** (nắp thư quay quanh cạnh trên), animate
`rotation.x` bằng GSAP. Niêm phong sáp = 1 mesh nhỏ + dissolve shader (T7). Thiệp bên trong
"mở ra" như sách: 2 plane quay quanh cạnh giữa.
→ Đây là màn đầu tiên khách thấy, cũng là cái cớ hợp lý để xin phép phát nhạc.

---

## NHÓM E — Post-processing & chi tiết làm nên đẳng cấp

```jsx
<EffectComposer>
  <Bloom intensity={0.8} luminanceThreshold={0.55} mipmapBlur />
  <DepthOfField focusDistance={0.01} focalLength={0.05} bokehScale={3} />  {/* desktop only */}
  <ChromaticAberration offset={[0.0006, 0.0006]} />
  <Vignette darkness={0.45} />
</EffectComposer>
```

Chi tiết nhỏ nhưng khác biệt lớn:
- **Bloom là bắt buộc** với particle additive — không có Bloom thì hạt trông như bụi bẩn.
- **Grain/film nhẹ** (noise 3–5%) làm cảnh trông "chụp bằng phim", đỡ cảm giác CGI.
- **Damping mọi thứ**: chuột, scroll, morph. Không có lerp = trông như code demo.
- **Nhạc** đóng góp ~40% cảm xúc. Fade in/out theo section.
- **Chuyển động theo gyroscope** trên mobile (`deviceorientation`) cho T11 — khách nghiêng
  điện thoại thấy ảnh có chiều sâu, ai cũng "wow".
- **prefers-reduced-motion**: tôn trọng nghiêm túc, có người bị say chuyển động.

---

## Nếu chỉ chọn 5 — lộ trình tôi khuyên

1. **T1 + T2** — Hero particle morphing với tên và ngày cưới thật. Đây là thứ khách chụp
   màn hình gửi cho nhau.
2. **T4** — Camera path, biến các section rời rạc thành một chuyến đi.
3. **T11** — Ảnh cưới 2.5D. Rẻ nhất, wow nhất, dùng đúng thứ bạn đã có sẵn (ảnh cưới).
4. **T6 + T8** — Cánh hoa và đom đóm. Lấp không gian trống, gần như miễn phí.
5. **T5** — Đôi nhẫn thuỷ tinh xoay ở section thông tin lễ. Điểm nhấn "vật thể thật" duy nhất.

Rồi nếu còn thời gian: T10 (mở bao thư) → T12/T13 (album) → T7 (dissolve) → T16 (GPGPU).
