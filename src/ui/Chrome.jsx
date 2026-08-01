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
    // 'metadata' chứ không phải 'auto': file nhạc 3.3MB, tải ngay từ đầu là nó
    // giành băng thông với ảnh và khung hình đầu — đúng thứ khách nhìn thấy
    // trước. Vẫn đủ để biết file có tồn tại hay không (404 thì nút tự ẩn).
    a.preload = 'metadata'
    a.addEventListener('error', () => setAvailable(false))
    audio.current = a

    // Trang tải xong rồi thì mới nạp sẵn cả bài, để lúc khách bấm là chạy liền
    // chứ không phải chờ buffer. Bỏ qua nếu nhạc đã kịp chạy trước đó —
    // load() giữa lúc đang phát là cắt ngang bài.
    let t = 0
    const warm = () => {
      t = setTimeout(() => {
        const el = audio.current
        if (!el || !el.paused || el.currentTime > 0) return
        el.preload = 'auto'
        el.load()
      }, 1500)
    }
    if (document.readyState === 'complete') warm()
    else window.addEventListener('load', warm, { once: true })

    return () => {
      clearTimeout(t)
      window.removeEventListener('load', warm)
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
      className={`music ${on ? 'on' : 'off'}`}
      onClick={() => setOn(!on)}
      aria-label={on ? 'Tắt nhạc' : 'Bật nhạc'}
      title={on ? 'Tắt nhạc' : 'Bật nhạc'}
      data-interactive
    >
      {/* Hai vòng sóng lan ra khi đang phát. Nằm trong nút nhưng scale vượt ra
          ngoài — đó mới là thứ khách thấy được từ khoé mắt, chứ nút 44px đứng im
          thì không ai biết nhạc đang chạy. */}
      <span className="song" aria-hidden="true">
        <i />
        <i />
      </span>

      {/* Nốt đơn ♪: một nét liền cho thân + đuôi móc, đầu nốt là ellipse nghiêng.
          Vẽ tay chứ không dùng ký tự ♪ — ký tự phụ thuộc font hệ thống, mỗi máy
          ra một kiểu và canh giữa không bao giờ chuẩn. Chọn nốt ĐƠN thay vì nốt
          đôi ♫ vì ở cỡ thật 44px thì ít nét hơn là sạch hơn. */}
      <svg className="note" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12.4 16.6V4.4c0 3.4 5 2.6 5 6.6"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <ellipse cx="9.6" cy="16.8" rx="3" ry="2.4" transform="rotate(-20 9.6 16.8)" fill="currentColor" />
        {/* gạch chéo chỉ hiện khi tắt — trạng thái tắt phải đọc được ngay, chứ
            chỉ làm mờ đi thì nhìn như nút bị vô hiệu hoá. Hướng ↘ để cắt ngang
            thân nốt; hướng ↗ thì gần như trùng chiều đuôi móc, nhìn lẫn vào nét
            nốt chứ không ra dấu gạch bỏ. */}
        <path className="slash" d="M4.5 4.5L19.5 19.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </button>
  )
}
