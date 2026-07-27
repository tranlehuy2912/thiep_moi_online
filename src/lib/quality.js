// Tự dò cấu hình máy → quyết định số hạt, post-fx, DPR.
// Có tự hạ cấp khi FPS tụt (xem watchFps bên dưới).

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
export const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
export const IS_IOS = /iPhone|iPad|iPod/i.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)

export const PREFERS_REDUCED =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

function detect() {
  if (PREFERS_REDUCED) return 'low'
  const cores = navigator.hardwareConcurrency || 4
  const mem = navigator.deviceMemory || 4
  if (IS_MOBILE) return cores >= 6 && mem >= 4 ? 'mid' : 'low'
  return cores >= 8 ? 'high' : 'mid'
}

export const TIERS = {
  low: { particles: 14000, petals: 220, fireflies: 60, dpr: 1, bloom: true, dof: false, transmission: false },
  mid: { particles: 34000, petals: 400, fireflies: 100, dpr: 1.4, bloom: true, dof: false, transmission: false },
  high: { particles: 70000, petals: 600, fireflies: 140, dpr: 1.75, bloom: true, dof: true, transmission: true },
}

let tier = detect()
export function getTier() {
  return tier
}
export function q() {
  return TIERS[tier]
}

// Có WebGL2 không? Không có thì App sẽ render bản 2D.
export function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

// Đo FPS 4 giây đầu, tụt quá thì hạ cấp một bậc.
export function watchFps(onDowngrade) {
  if (tier === 'low') return () => {}
  let frames = 0
  let start = performance.now()
  let raf = 0
  let done = false
  const tick = () => {
    frames++
    const dt = performance.now() - start
    if (dt > 4000 && !done) {
      done = true
      const fps = (frames / dt) * 1000
      if (fps < 38) {
        tier = tier === 'high' ? 'mid' : 'low'
        onDowngrade?.(tier)
      }
      return
    }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}
