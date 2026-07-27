// Nạp ảnh an toàn: thiếu file thì tự vẽ ảnh giữ chỗ cùng tông poster,
// nhờ vậy trang chạy được A→Z ngay cả khi chưa có ảnh cưới nào.
import * as THREE from 'three'
import { PALETTE } from '../config.js'

const cache = new Map()
const loader = new THREE.TextureLoader()

export function placeholderCanvas(label = '', seed = 0) {
  const w = 720
  const h = 1000
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')

  const g = ctx.createLinearGradient(0, 0, w * 0.6, h)
  g.addColorStop(0, PALETTE.skyMid)
  g.addColorStop(0.45, '#2C4E57')
  g.addColorStop(1, PALETTE.skyDeep)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // quầng nắng
  const r = ctx.createRadialGradient(w * 0.68, h * 0.28, 10, w * 0.68, h * 0.28, w * 0.85)
  r.addColorStop(0, 'rgba(255,215,154,0.55)')
  r.addColorStop(0.5, 'rgba(231,190,114,0.16)')
  r.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = r
  ctx.fillRect(0, 0, w, h)

  // vài vệt sáng cho đỡ phẳng
  ctx.globalAlpha = 0.12
  ctx.strokeStyle = PALETTE.goldLight
  for (let i = 0; i < 8; i++) {
    ctx.lineWidth = 1 + ((seed + i) % 3)
    ctx.beginPath()
    ctx.moveTo(((seed * 97 + i * 131) % w), 0)
    ctx.lineTo(((seed * 53 + i * 211) % w) + 180, h)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // khung viền vàng
  ctx.strokeStyle = 'rgba(231,190,114,0.45)'
  ctx.lineWidth = 3
  ctx.strokeRect(22, 22, w - 44, h - 44)

  ctx.fillStyle = 'rgba(246,239,225,0.72)'
  ctx.textAlign = 'center'
  ctx.font = '500 34px "Cormorant Garamond", Georgia, serif'
  ctx.fillText(label || 'Ảnh cưới', w / 2, h / 2 - 10)
  ctx.font = '300 19px "Be Vietnam Pro", sans-serif'
  ctx.fillStyle = 'rgba(246,239,225,0.42)'
  ctx.fillText('thả ảnh vào public/photos/', w / 2, h / 2 + 28)

  return c
}

function makePlaceholder(label, seed) {
  const tex = new THREE.CanvasTexture(placeholderCanvas(label, seed))
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// Trả về NGAY một texture giữ chỗ, chưa tải gì cả.
// Album có tới vài chục ảnh — tải hết một lượt là vừa nghẽn mạng vừa ngốn VRAM
// (mỗi ảnh 1200×800 chiếm ~3.8MB bộ nhớ GPU sau khi giải nén).
export function getTexture(url, { label = '', seed = 0 } = {}) {
  if (!cache.has(url)) cache.set(url, makePlaceholder(label, seed))
  return cache.get(url)
}

// Gọi khi ảnh sắp lọt vào tầm nhìn: lúc này mới thật sự tải file về.
// Gọi bao nhiêu lần cũng được, chỉ tải một lần.
export function ensureLoaded(url, onLoad) {
  const tex = cache.get(url)
  if (!url || !tex || tex.userData.requested) return tex
  tex.userData.requested = true

  loader.load(
    url,
    (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace
      // tráo nội dung ảnh thật vào chính texture đang dùng
      tex.image = loaded.image
      tex.needsUpdate = true
      tex.userData.real = true
      onLoad?.(tex)
    },
    undefined,
    () => {
      /* không có ảnh → giữ ảnh giữ chỗ, im lặng */
    },
  )
  return tex
}

// Tải ngay (dùng cho ảnh đơn lẻ, không phải album)
export function loadTexture(url, opts = {}) {
  getTexture(url, opts)
  return ensureLoaded(url, opts.onLoad)
}

// URL ảnh giữ chỗ dạng dataURL, dùng cho <img> trong phần HTML
const domCache = new Map()
export function placeholderDataUrl(label, seed = 0) {
  const key = `${label}|${seed}`
  if (!domCache.has(key)) domCache.set(key, placeholderCanvas(label, seed).toDataURL('image/jpeg', 0.7))
  return domCache.get(key)
}
