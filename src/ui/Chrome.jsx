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

// Nhớ lựa chọn bật/tắt nhạc giữa các lần mở thiệp.
//
// CHỈ ghi khi khách TỰ BẤM nút. Nhạc tự phát rồi khách không đụng tới thì không
// tính là lựa chọn — để đó, lần sau vẫn tự phát.
const KHOA_NHAC = 'thiep:nhac'

// null = khách chưa từng chọn gì
function docYThich() {
  try {
    const v = localStorage.getItem(KHOA_NHAC)
    return v === null ? null : v === '1'
  } catch {
    // Safari chế độ riêng tư và mấy trình duyệt chặn cookie NÉM lỗi ở dòng
    // trên. Để lỗi thoát ra là cả nút nhạc chết theo — nuốt, coi như chưa chọn.
    return null
  }
}

function ghiYThich(bat) {
  try {
    localStorage.setItem(KHOA_NHAC, bat ? '1' : '0')
  } catch {
    /* xem docYThich */
  }
}

export function Music() {
  const on = useStore((s) => s.musicOn)
  const setOn = useStore((s) => s.setMusicOn)
  const [available, setAvailable] = useState(true)
  const audio = useRef(null)
  // Khách đã tự bấm nút chưa — xem chỗ dùng ở `batDau` bên dưới
  const daTuChon = useRef(false)

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

  // Mở thiệp là nhạc chạy.
  useEffect(() => {
    // Lần trước khách đã tắt đi → tôn trọng, đừng bật lại. Cũng không gắn nghe
    // ngóng gì cả: khách muốn nghe thì tự bấm nút.
    if (docYThich() === false) return

    let huy = false
    const thoiNghe = () => {
      window.removeEventListener('pointerdown', batDau)
      window.removeEventListener('keydown', batDau)
      window.removeEventListener('touchstart', batDau)
    }
    const batDau = () => {
      thoiNghe()
      // Khách vừa bấm THẲNG vào nút nhạc để tắt thì đừng bật đè lên. React gọi
      // onClick của nút TRƯỚC listener trên window nên cờ này đã kịp bật. Không
      // có nó thì cú bấm tắt đầu tiên bị chính chỗ này bật lại ngay.
      if (huy || daTuChon.current) return
      audio.current?.play().then(() => setOn(true)).catch(() => {})
    }

    // Cách 1 — thử phát luôn.
    // Hầu hết trình duyệt CHẶN phát tự động có tiếng khi khách chưa thao tác gì:
    // promise bị từ chối, rơi xuống cách 2. Nhưng máy nào đã từng nghe nhạc trên
    // tên miền này thì Chrome cho qua, nên vẫn đáng thử — được thì khách nghe
    // nhạc ngay từ giây đầu, khỏi phải chạm.
    audio.current
      ?.play()
      .then(() => {
        if (huy) return
        setOn(true)
        thoiNghe() // đã chạy rồi thì thôi nghe ngóng
      })
      .catch(() => {})

    // Cách 2 — bị chặn thì bắt cú chạm/gõ phím ĐẦU TIÊN, ở bất kỳ đâu trên trang.
    window.addEventListener('pointerdown', batDau)
    window.addEventListener('keydown', batDau)
    window.addEventListener('touchstart', batDau, { passive: true })
    return () => {
      huy = true
      thoiNghe()
    }
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
      onClick={() => {
        daTuChon.current = true
        ghiYThich(!on)
        setOn(!on)
      }}
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
