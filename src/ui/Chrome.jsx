// Thanh tiến độ, nav dots, nút nhạc — những thứ "nổi" trên mọi màn.
import { useEffect, useRef, useState } from 'react'
import { SECTIONS, MUSIC } from '../config.js'
import { scrollState, scrollToSection } from '../lib/scroll.js'
import { useStore } from '../store.js'

export function Progress() {
  const bar = useRef(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      if (bar.current) bar.current.style.width = `${scrollState.progress * 100}%`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <div className="progress" ref={bar} />
}

export function Nav() {
  const section = useStore((s) => s.section)
  return (
    <nav className="nav" aria-label="Điều hướng thiệp">
      {SECTIONS.map((s, i) => (
        <button
          key={s.id}
          className={i === section ? 'on' : ''}
          onClick={() => scrollToSection(i)}
          title={s.label}
          aria-label={s.label}
          data-interactive
        >
          <i />
        </button>
      ))}
    </nav>
  )
}

export function Music() {
  const on = useStore((s) => s.musicOn)
  const setOn = useStore((s) => s.setMusicOn)
  const [available, setAvailable] = useState(true)
  const audio = useRef(null)

  useEffect(() => {
    const a = new Audio(MUSIC.src)
    a.loop = true
    a.volume = 0
    a.preload = 'auto'
    a.addEventListener('error', () => setAvailable(false))
    audio.current = a
    return () => {
      a.pause()
      audio.current = null
    }
  }, [])

  // Trình duyệt chỉ cho phát nhạc sau một thao tác thật của người dùng.
  // Không còn màn "Mở thiệp" nữa nên bắt lấy cú chạm/gõ phím ĐẦU TIÊN, dù ở đâu.
  useEffect(() => {
    const start = () => {
      const a = audio.current
      if (!a) return
      a.play()
        .then(() => setOn(true))
        .catch(() => {
          /* vẫn bị chặn — khách tự bấm nút nhạc */
        })
      off()
    }
    const off = () => {
      window.removeEventListener('pointerdown', start)
      window.removeEventListener('keydown', start)
      window.removeEventListener('touchstart', start)
    }
    window.addEventListener('pointerdown', start, { once: true })
    window.addEventListener('keydown', start, { once: true })
    window.addEventListener('touchstart', start, { once: true, passive: true })
    return off
  }, [setOn])

  // fade âm lượng cho êm
  useEffect(() => {
    const a = audio.current
    if (!a) return
    let raf = 0
    const target = on ? MUSIC.volume : 0
    const step = () => {
      a.volume += (target - a.volume) * 0.06
      if (Math.abs(a.volume - target) > 0.005) raf = requestAnimationFrame(step)
      else {
        a.volume = target
        if (!on) a.pause()
      }
    }
    if (on && a.paused) a.play().catch(() => {})
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [on])

  if (!available) return null

  return (
    <button
      className={`music ${on ? '' : 'off'}`}
      onClick={() => setOn(!on)}
      aria-label={on ? 'Tắt nhạc' : 'Bật nhạc'}
      title={on ? 'Tắt nhạc' : 'Bật nhạc'}
      data-interactive
    >
      <span className="bars" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
    </button>
  )
}
