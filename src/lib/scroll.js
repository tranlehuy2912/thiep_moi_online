// Trạng thái cuộn dùng chung.
// Cố ý KHÔNG để trong React state: useFrame đọc trực tiếp object này mỗi frame,
// nếu đẩy vào state thì React re-render 60 lần/giây.
import { SECTIONS } from '../config.js'

export const scrollState = {
  y: 0,
  progress: 0, // 0..1 toàn trang
  section: 0, // index màn đang xem
  local: 0, // 0..1 tiến độ trong màn hiện tại
  velocity: 0, // px/frame, đã làm mượt
  smooth: 0, // progress đã damp — dùng để lái camera
  pointer: { x: 0, y: 0 }, // -1..1
  pointerSmooth: { x: 0, y: 0 },
  tilt: { x: 0, y: 0 }, // gyroscope điện thoại
}

let lastY = 0
const els = []

export function registerSection(id, el) {
  const i = SECTIONS.findIndex((s) => s.id === id)
  if (i >= 0 && el) els[i] = el
}

function measure() {
  const vh = window.innerHeight
  const y = window.scrollY || window.pageYOffset
  scrollState.y = y

  const max = Math.max(1, document.documentElement.scrollHeight - vh)
  scrollState.progress = Math.min(1, Math.max(0, y / max))

  const v = y - lastY
  lastY = y
  scrollState.velocity += (v - scrollState.velocity) * 0.25

  // Màn nào đang chiếm giữa màn hình
  const mid = y + vh * 0.5
  let best = 0
  for (let i = 0; i < els.length; i++) {
    const el = els[i]
    if (!el) continue
    const top = el.offsetTop
    if (mid >= top) best = i
  }
  scrollState.section = best

  const cur = els[best]
  if (cur) {
    const t = (y + vh * 0.5 - cur.offsetTop) / Math.max(1, cur.offsetHeight)
    scrollState.local = Math.min(1, Math.max(0, t))
  }
}

let onSectionChange = null
export function setSectionListener(fn) {
  onSectionChange = fn
}

let rafId = 0
let dirty = true
let prevSection = -1

function loop() {
  if (dirty) {
    measure()
    dirty = false
    if (scrollState.section !== prevSection) {
      prevSection = scrollState.section
      onSectionChange?.(scrollState.section)
    }
  }
  // damp cho camera & con trỏ
  scrollState.smooth += (scrollState.progress - scrollState.smooth) * 0.08
  scrollState.pointerSmooth.x += (scrollState.pointer.x - scrollState.pointerSmooth.x) * 0.06
  scrollState.pointerSmooth.y += (scrollState.pointer.y - scrollState.pointerSmooth.y) * 0.06
  scrollState.velocity *= 0.9
  rafId = requestAnimationFrame(loop)
}

export function initScroll() {
  const mark = () => {
    dirty = true
  }
  window.addEventListener('scroll', mark, { passive: true })
  window.addEventListener('resize', mark)

  const onPointer = (e) => {
    scrollState.pointer.x = (e.clientX / window.innerWidth) * 2 - 1
    scrollState.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1)
  }
  window.addEventListener('pointermove', onPointer, { passive: true })

  // Nghiêng điện thoại → parallax (thay cho chuột trên mobile)
  const onTilt = (e) => {
    if (e.gamma == null || e.beta == null) return
    scrollState.tilt.x = Math.max(-1, Math.min(1, e.gamma / 35))
    scrollState.tilt.y = Math.max(-1, Math.min(1, (e.beta - 45) / 35))
    scrollState.pointer.x = scrollState.tilt.x
    scrollState.pointer.y = -scrollState.tilt.y
  }
  window.addEventListener('deviceorientation', onTilt)

  measure()
  scrollState.smooth = scrollState.progress
  loop()

  return () => {
    cancelAnimationFrame(rafId)
    window.removeEventListener('scroll', mark)
    window.removeEventListener('resize', mark)
    window.removeEventListener('pointermove', onPointer)
    window.removeEventListener('deviceorientation', onTilt)
  }
}

// Cuộn tới 1 màn (dùng cho nav dots)
export function scrollToSection(i) {
  const el = els[i]
  if (el) window.scrollTo({ top: el.offsetTop, behavior: 'smooth' })
}
