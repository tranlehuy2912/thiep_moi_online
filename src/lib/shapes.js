// Sinh các "đám mây điểm" cho hệ hạt morphing (kỹ thuật T1/T2).
// Mọi hình đều trả về Float32Array độ dài COUNT*3 để nhồi thẳng vào attribute.
import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'

// ===========================================================================
//  Bộ lấy mẫu dùng chung: vẽ hình phẳng ra canvas 2D rồi rắc hạt vào vùng mực.
//
//  Dùng cho CẢ chữ và trái tim, vì:
//   • Chữ  — canvas fillText giữ đúng dấu tiếng Việt, không cần font JSON.
//   • Tim  — ExtrudeGeometry + bevel to sẽ tự cắt nhau ở chỗ khuyết trên đỉnh
//            tim, sinh tam giác rác và hạt bắn ra thành gai. Tô path 2D thì
//            đường viền luôn sạch.
//
//  Ba thứ quyết định hình có "sắc nét" hay không:
//   1. Rắc hạt theo XÁC SUẤT tỉ lệ với alpha → rìa anti-alias thưa dần, không
//      bị cắt cụt thành bậc thang như khi đặt ngưỡng cứng alpha > 120.
//   2. Rung hạt LIÊN TỤC trong ô lưới → không thấy dấu vết lưới lấy mẫu.
//   3. Độ dày Z giảm dần về phía rìa → hình có khối như cái gối, nhưng đường
//      viền vẫn mỏng và gọn.
// ===========================================================================

const OFF8 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.7, 0.7],
  [-0.7, 0.7],
  [0.7, -0.7],
  [-0.7, -0.7],
]

function sampleMask(ctx, w, h, count, opts = {}) {
  const { step = 2, depth = 0.18, targetWidth, targetHeight } = opts
  const data = ctx.getImageData(0, 0, w, h).data
  const alphaAt = (x, y) => {
    const xi = x | 0
    const yi = y | 0
    if (xi < 0 || yi < 0 || xi >= w || yi >= h) return 0
    return data[((yi * w + xi) << 2) + 3]
  }

  // --- 1. gom các ô có mực, kèm độ đậm ---
  const cx = []
  const cy = []
  const cw = []
  let total = 0
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const a = alphaAt(x, y)
      if (a < 10) continue
      cx.push(x)
      cy.push(y)
      cw.push(a / 255)
      total += a / 255
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (!cx.length) return null

  // --- 2. tỉ lệ quy đổi sang đơn vị thế giới ---
  // Đưa cả hai giới hạn thì lấy cái NHỎ hơn: hình vừa không cao quá, vừa không
  // tràn ngang. Cặp trái tim trên điện thoại là trường hợp cần đúng chỗ này.
  const inkW = Math.max(1, maxX - minX)
  const inkH = Math.max(1, maxY - minY)
  const kH = targetHeight ? targetHeight / inkH : Infinity
  const kW = targetWidth ? targetWidth / inkW : Infinity
  const k = Math.min(kH, kW)
  if (!Number.isFinite(k)) return null // gọi mà không đưa giới hạn nào
  const ox = (minX + maxX) / 2
  const oy = (minY + maxY) / 2

  // --- 3. bán kính dò "ruột hay rìa" (cho độ dày Z) ---
  const probe = Math.max(2, Math.round(Math.min(inkW, inkH) * 0.05))
  const interiorness = (x, y) => {
    let n = 0
    for (let i = 0; i < 8; i++) {
      if (alphaAt(x + OFF8[i][0] * probe, y + OFF8[i][1] * probe) > 110) n++
    }
    return n / 8
  }

  // --- 4. rắc hạt: mỗi ô nhận số hạt tỉ lệ với độ đậm của nó ---
  const out = new Float32Array(count * 3)
  let i = 0

  const emit = (c) => {
    // rung liên tục trong ô → xoá sạch dấu vết lưới lấy mẫu
    const px = cx[c] + (Math.random() - 0.5) * step
    const py = cy[c] + (Math.random() - 0.5) * step
    const t = interiorness(px, py)
    out[i * 3] = (px - ox) * k
    out[i * 3 + 1] = -(py - oy) * k
    out[i * 3 + 2] = (Math.random() - 0.5) * depth * t
    i++
  }

  // Lượt chính cố ý rắc hơi thiếu (0.96) để chắc chắn quét hết hình — nếu để
  // vừa khít mà làm tròn lên vài ô là hạt hết giữa đường và cụt mất phần dưới.
  const perWeight = (count * 0.96) / total
  for (let c = 0; c < cx.length && i < count; c++) {
    const n = cw[c] * perWeight
    let ni = Math.floor(n)
    // phần thập phân xử lý bằng xác suất → mật độ đúng mà không bị lệch do làm tròn
    if (Math.random() < n - ni) ni++
    for (let j = 0; j < ni && i < count; j++) emit(c)
  }

  // Bù cho đủ COUNT bằng cách chọn ô NGẪU NHIÊN, không quét tuần tự —
  // quét tuần tự thì phần hạt bù sẽ dồn hết vào mấy hàng trên cùng.
  while (i < count) emit((Math.random() * cx.length) | 0)

  return out
}

// ===========================================================================
//  Hình 1 — trái tim
// ===========================================================================

// Đường tim tham số kinh điển: mượt hơn hẳn so với ghép các đoạn bezier.
//
// Hàm thuần, không đụng canvas — nhờ vậy scripts/preview-shapes.mjs dựng lại
// được đúng hình này ra file PNG để xem trước mà không cần trình duyệt.
//
// Trả về toạ độ đã CHUẨN HOÁ: tâm mực ở gốc, trục y hướng xuống (kiểu màn hình),
// hình rộng 32 đơn vị × cao 29 đơn vị.
export const HEART_W = 32
export const HEART_H = 29

export function heartOutline(steps = 260) {
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const s = Math.sin(t)
    const x = 16 * s * s * s
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    // y của công thức chạy từ −17 đến +12 → tâm mực lệch −2.5, phải bù lại
    pts.push([x, -(y + 2.5)])
  }
  return pts
}

function fillHeart(ctx, outline, cx, cy, scale, rot) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  ctx.beginPath()
  for (let i = 0; i < outline.length; i++) {
    const px = outline[i][0] * scale
    const py = outline[i][1] * scale
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// Bố cục hai trái tim: nghiêng ra ngoài một chút để hai mũi tim chụm lại ở dưới,
// đọc ra ngay là "hai trái tim tựa vào nhau". Tách riêng để script xem trước
// dùng chung đúng con số này.
export const HEART_PAIR = {
  tilt: 0.175, // ≈ 10°
  // Tâm mỗi tim lệch khỏi trục giữa bấy nhiêu lần bề ngang một tim.
  // Càng nhỏ hai tim càng sát. Giới hạn dưới khoảng 0.30: từ 0.28 trở xuống là
  // khe chữ V ở đỉnh biến mất, hai tim nhập thành một khối bè bè.
  //
  // Hạ từ 0.36 xuống 0.34 khi thêm `rise`: lệch dọc tự nó đã kéo hai tâm xa
  // thêm ~8%, không bù lại thì cặp tim trông thưa ra so với lúc chưa lệch.
  gap: 0.34,
  // Lệch dọc, tính theo chiều cao một tim. Dương = tim TRÁI lên, tim PHẢI xuống.
  rise: 0.16,
}

// HAI trái tim tựa vào nhau.
//
// `maxWidth` là bắt buộc trên thực tế: cặp tim rộng gần gấp đôi một tim, nếu chỉ
// chuẩn hoá theo chiều cao thì trên điện thoại (khung ngang chỉ ~3.4 đơn vị) nó
// sẽ tràn ra ngoài hai mép màn hình.
export function heartPoints(count, height = 2.4, maxWidth = Infinity) {
  const S = 11
  const { tilt, gap, rise } = HEART_PAIR
  const outline = heartOutline()

  // nửa bề ngang/cao của MỘT tim sau khi nghiêng
  const hw = (HEART_W / 2) * Math.cos(tilt) + (HEART_H / 2) * Math.sin(tilt)
  const hh = (HEART_H / 2) * Math.cos(tilt) + (HEART_W / 2) * Math.sin(tilt)
  const offX = HEART_W * gap // lệch ngang của mỗi tim
  const offY = HEART_H * rise // lệch dọc của mỗi tim
  const pad = 40 // chừa lề: mũi tim không bị cắt, và bán kính dò ruột/rìa còn chỗ

  const W = Math.ceil((offX + hw) * 2 * S) + pad * 2
  const H = Math.ceil((Math.abs(offY) + hh) * 2 * S) + pad * 2

  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'
  // Nghiêng ngược chiều nhau → hai mũi tim chụm lại ở phía dưới.
  // Trục y của canvas hướng XUỐNG nên trừ offY mới là nâng lên.
  fillHeart(ctx, outline, W / 2 - offX * S, H / 2 - offY * S, S, -tilt)
  fillHeart(ctx, outline, W / 2 + offX * S, H / 2 + offY * S, S, tilt)

  return (
    sampleMask(ctx, W, H, count, {
      step: 2,
      depth: height * 0.3,
      targetHeight: height,
      targetWidth: maxWidth,
    }) || spherePoints(count, height * 0.5)
  )
}

// ===========================================================================
//  Hình 2 — đôi nhẫn lồng nhau (đây là hình khối thật, lấy mẫu trên bề mặt)
// ===========================================================================

function sampleMesh(geometry, count, matrix) {
  // MeshSurfaceSampler lấy mẫu trong KHÔNG GIAN LOCAL của geometry, không nhìn tới
  // ma trận của mesh → phải nướng thẳng phép biến đổi vào geometry.
  if (matrix) geometry.applyMatrix4(matrix)
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())
  const sampler = new MeshSurfaceSampler(mesh).build()
  const out = new Float32Array(count * 3)
  const p = new THREE.Vector3()
  for (let i = 0; i < count; i++) {
    sampler.sample(p)
    out[i * 3] = p.x
    out[i * 3 + 1] = p.y
    out[i * 3 + 2] = p.z
  }
  geometry.dispose?.()
  return out
}

// ---------------------------------------------------------------------------
//  Hai nhẫn LỒNG VÀO NHAU (không phải chỉ chồng lên nhau)
//
//  Đặt nhẫn A nằm trong mặt phẳng XY, tâm ở gốc. Đường tròn của nhẫn B xuyên
//  qua mặt phẳng đó đúng hai lần; muốn lồng thì MỘT điểm xuyên phải nằm trong
//  lỗ nhẫn A, điểm còn lại nằm ngoài vành.
//
//  ⚠️ Đây là chỗ bản cũ sai: nó xoay nhẫn B quanh trục Y. Khi ấy hai điểm xuyên
//  đều cách tâm A đúng √(dx²+r²) — BẰNG NHAU — nên hoặc cả hai cùng nằm trong,
//  hoặc cả hai cùng nằm ngoài. Không đời nào lồng được, chỉ dính vào nhau.
//
//  Xoay quanh trục X (trục nằm TRONG mặt phẳng nhẫn A) thì hai điểm xuyên rơi
//  vào (dx−r) và (dx+r) — khác nhau, nên lồng được. Góc xoay bao nhiêu không
//  quan trọng, miễn khác 0; chỉ khoảng dời dx mới quyết định.
// ---------------------------------------------------------------------------
//  Chọn góc nghiêng: hạt vẽ bằng blending CỘNG nên không có che khuất — mất
//  hẳn cái mẹo "chỗ này đè lên chỗ kia" của hình chuỗi xích vẽ tay. Vì vậy
//  nghiêng phải ĐỦ LỚN để riêng đường bao đã nói lên chuyện xỏ qua nhau. Thử
//  bằng ảnh phẳng một màu: 0.7 rad vẫn chỉ ra hai vòng tròn chồng nhau, tới
//  1.2 rad mới đọc ra ngay là lồng vào nhau mà nhẫn B vẫn còn dáng nhẫn.
export const RING_LINK = {
  tiltB: 1.2, // góc nghiêng nhẫn B quanh trục X (rad ≈ 69°)
  dx: 1.1, // tâm nhẫn B dời theo X, tính theo bán kính nhẫn
  tube: 0.1, // bề dày vành, tính theo bán kính nhẫn
  poseX: -0.2, // nghiêng chung cả cặp, để nhìn thấy chiều sâu
  poseY: 0.35,
}

//  Bộ tham số cho ĐÔI NHẪN KIM LOẠI ĐẶC ở màn cuối (three/Rings.jsx).
//  Cùng quy tắc lồng (dời theo X, xoay quanh X), nhưng nghiêng NHẸ hơn nhiều:
//  mesh đặc có che khuất thật, chỗ vành này chui sau vành kia nhìn thấy rõ, nên
//  không phải bẻ mạnh như bản hạt. Nhờ vậy cả hai vẫn ra dáng nhẫn cưới.
//  poseY phải ÂM: nhẫn B lệch về phía +X, mà xoay quanh Y theo chiều dương thì
//  +X bị đẩy ra sau — nhẫn B chìm gần hết sau nhẫn A (đo được: chỉ còn 18% nằm
//  trước). Đảo dấu thì nhẫn B nổi lên ~77%, hai nhẫn cùng thấy rõ và chỗ vành
//  chui qua nhau hiện ra đúng chất mắt xích.
export const RING_LINK_SOLID = {
  tiltB: 0.75, // ≈ 43°
  dx: 1.25,
  tube: 0.11,
  poseX: -0.2,
  poseY: -0.33,
}

// Khoảng cách (theo bán kính) từ tâm nhẫn A tới hai điểm mà nhẫn B xuyên qua
// mặt phẳng nhẫn A.
export function ringCrossings(dx) {
  return [Math.abs(dx - 1), dx + 1]
}

export function ringsAreLinked({ dx, tube }) {
  const [near, far] = ringCrossings(dx)
  return near < 1 - tube && far > 1 + tube
}

// Dồn về giữa và ép vừa bề ngang cho phép.
function fitWidth(arr, maxWidth) {
  let mnx = Infinity
  let mxx = -Infinity
  let mny = Infinity
  let mxy = -Infinity
  for (let i = 0; i < arr.length; i += 3) {
    if (arr[i] < mnx) mnx = arr[i]
    if (arr[i] > mxx) mxx = arr[i]
    if (arr[i + 1] < mny) mny = arr[i + 1]
    if (arr[i + 1] > mxy) mxy = arr[i + 1]
  }
  const w = mxx - mnx
  const k = Number.isFinite(maxWidth) && w > maxWidth ? maxWidth / w : 1
  const cx = (mnx + mxx) / 2
  const cy = (mny + mxy) / 2
  for (let i = 0; i < arr.length; i += 3) {
    arr[i] = (arr[i] - cx) * k
    arr[i + 1] = (arr[i + 1] - cy) * k
    arr[i + 2] *= k
  }
  return arr
}

export function ringsPoints(count, radius = 1.05, maxWidth = Infinity) {
  const { tiltB, dx, tube, poseX, poseY } = RING_LINK
  const half = Math.floor(count / 2)
  const t = radius * tube

  // nhiều đoạn dọc vành: vành nhẫn là đường tròn lớn, thiếu đoạn là thấy ngay
  // các cạnh thẳng nối nhau thành đa giác
  const g1 = new THREE.TorusGeometry(radius, t, 18, 220)
  const g2 = new THREE.TorusGeometry(radius, t, 18, 220)

  const pose = new THREE.Matrix4()
    .makeRotationX(poseX)
    .multiply(new THREE.Matrix4().makeRotationY(poseY))

  const mA = pose.clone()

  // p' = pose · dịch(dx) · xoayX(tiltB) · p
  const mB = pose
    .clone()
    .multiply(new THREE.Matrix4().makeTranslation(radius * dx, 0, 0))
    .multiply(new THREE.Matrix4().makeRotationX(tiltB))

  const a = sampleMesh(g1, half, mA)
  const b = sampleMesh(g2, count - half, mB)

  const out = new Float32Array(count * 3)
  out.set(a, 0)
  out.set(b, a.length)
  return fitWidth(out, maxWidth)
}

// ===========================================================================
//  Hình 3 — MONOGRAM: hai chữ cái lồng vào nhau
//
//  Vì sao phải có hàm riêng thay vì cứ fillText('HT'): canvas luôn đặt chữ
//  theo metric của font, hai chữ KHÔNG BAO GIỜ chạm nhau. Muốn nối thì phải tự
//  đo bề ngang từng chữ rồi kéo chữ sau đè lên chữ trước.
//
//  Hạt vẽ bằng blending CỘNG nên không có che khuất — chỗ hai nét giao nhau tự
//  sáng hơn, đọc ra ngay là hai chữ đan vào nhau chứ không phải dán cạnh nhau.
// ===========================================================================

export const MONOGRAM = {
  // Chồng bao nhiêu phần bề ngang của chữ HẸP hơn.
  //
  // 0.10 là chỗ chân chữ T gác đúng lên chân chữ H: hai chữ dính liền mà vẫn
  // đọc rõ từng chữ. Đã dựng thử và nhìn tận mắt các mức 0.06 / 0.10 / 0.14 /
  // 0.20 / 0.32 — từ 0.20 trở lên là chữ T bị chữ H nuốt dần, tới 0.32 thì cả
  // cụm thành một khối không đọc được nữa.
  //
  // ⚠️ Đừng hạ xuống 0.06 dù nhìn vẫn "có vẻ" chạm nhau: đếm thành phần liên
  // thông ra HAI mảng rời, tức là chưa dính thật. 0.10 mới là ngưỡng.
  overlap: 0.1,

  // Cỡ trái tim so với cỡ chữ. ĐANG TẮT (0) — và nên để nguyên vậy.
  //
  // Đã thử tim ở các cỡ 0.22 / 0.30 / 0.40 treo dưới chỗ giao nhau: hai chữ che
  // mất phần trên của tim, chỉ còn cái mũi nhọn thò xuống dưới chân chữ, nhìn ra
  // một cái gai chứ không ra trái tim. Muốn có tim thì dùng { type: 'heart' }
  // riêng một nhịp trong PARTICLE.sequence, đẹp hơn nhiều.
  heart: 0,

  // Tim nằm thấp hơn tâm chữ bao nhiêu (theo cỡ chữ), nếu bật tim trở lại.
  heartDrop: 0.34,
}

export function monogramPoints(count, opts = {}) {
  const {
    left = 'H',
    right = 'T',
    fontFamily = '"Playfair Display", Georgia, serif',
    weight = 700,
    fontSize = 300,
    overlap = MONOGRAM.overlap,
    heart = MONOGRAM.heart,
    heartDrop = MONOGRAM.heartDrop,
    targetWidth = 4,
  } = opts

  const c = document.createElement('canvas')
  const ctx = c.getContext('2d', { willReadFrequently: true })
  const font = `${weight} ${fontSize}px ${fontFamily}`

  ctx.font = font
  const wL = ctx.measureText(left).width
  const wR = ctx.measureText(right).width
  const dx = overlap * Math.min(wL, wR) // số pixel chữ sau lùi vào chữ trước
  const pad = fontSize * 0.35

  c.width = Math.ceil(wL + wR - dx + pad * 2)
  c.height = Math.ceil(fontSize * 1.8 + pad * 2)

  // đổi kích thước canvas là mọi thiết lập bị xoá sạch → phải set lại font
  ctx.font = font
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'

  const midY = c.height / 2
  ctx.fillText(left, pad, midY)
  ctx.fillText(right, pad + wL - dx, midY)

  // Trái tim nhỏ treo ngay chỗ hai chữ giao nhau. Để tim to hoặc đặt vào giữa
  // thân chữ thì nó nuốt mất nét, cả cụm thành một vệt sáng không đọc được.
  if (heart > 0) {
    fillHeart(
      ctx,
      heartOutline(),
      pad + wL - dx / 2,
      midY + fontSize * heartDrop,
      (fontSize * heart) / HEART_H,
      0,
    )
  }

  return (
    sampleMask(ctx, c.width, c.height, count, { step: 2, depth: 0.14, targetWidth }) ||
    textPoints(`${left} ♥ ${right}`, count, { targetWidth })
  )
}

// ===========================================================================
//  Hình 4 — chữ → hạt
// ===========================================================================

export function textPoints(text, count, opts = {}) {
  const {
    fontFamily = '"Playfair Display", Georgia, serif',
    weight = 700,
    fontSize = 260,
    // Bề ngang MONG MUỐN của dòng chữ, tính bằng đơn vị thế giới. Chữ tự co
    // theo đây thay vì dùng một hằng số "scale" cứng — chữ dài ngắn khác nhau
    // mà dùng chung scale thì kiểu gì cũng có cái tràn ra ngoài khung hình.
    targetWidth = 5.6,
  } = opts

  const c = document.createElement('canvas')
  const ctx = c.getContext('2d', { willReadFrequently: true })
  const font = `${weight} ${fontSize}px ${fontFamily}`

  ctx.font = font
  const pad = fontSize * 0.4
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2
  const h = Math.ceil(fontSize * 1.9)
  c.width = w
  c.height = h

  // canvas reset sau khi đổi kích thước → phải set lại font
  ctx.font = font
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(text, pad, h * 0.5)

  // step 2 trên canvas 260px: mỗi nét chữ được vài chục hàng hạt, đủ để
  // đường cong và góc chữ ra mượt. step 3 là bắt đầu thấy răng cưa.
  return (
    sampleMask(ctx, w, h, count, { step: 2, depth: 0.12, targetWidth }) || heartPoints(count)
  )
}

// ===========================================================================
//  Hình 5 — quả cầu (nhịp nghỉ giữa hai hình)
// ===========================================================================

export function spherePoints(count, radius = 1.55) {
  const out = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    // phân bố đều trên mặt cầu, hơi dày vào trong
    const u = Math.random() * 2 - 1
    const th = Math.random() * Math.PI * 2
    const r = radius * (0.85 + Math.random() * 0.15)
    const s = Math.sqrt(1 - u * u)
    out[i * 3] = r * s * Math.cos(th)
    out[i * 3 + 1] = r * u * 0.7
    out[i * 3 + 2] = r * s * Math.sin(th)
  }
  return out
}

// Chờ webfont sẵn sàng rồi mới quét pixel, không thì chữ ra font mặc định.
export async function waitForFonts() {
  if (!document.fonts) return
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('700 260px "Playfair Display"'),
        document.fonts.load('600 260px "Cormorant Garamond"'),
      ]).then(() => document.fonts.ready),
      new Promise((r) => setTimeout(r, 3000)),
    ])
  } catch {
    /* thôi kệ, dùng font fallback */
  }
}
