import { useEffect, useState, lazy, Suspense } from 'react'
import { Hero, SaveTheDate, Gallery, Details, Rsvp, Outro } from './ui/Sections.jsx'
import { Progress, Nav, Music } from './ui/Chrome.jsx'
import { initScroll, setSectionListener } from './lib/scroll.js'
import { useReveal } from './lib/useReveal.js'
import { hasWebGL, watchFps } from './lib/quality.js'
import { hamNongAnh } from './lib/hamnong-anh.js'
import { useStore } from './store.js'

// Canvas + three.js tách thành chunk riêng, chỉ tải sau khi phần chữ đã hiện.
const Stage = lazy(() => import('./three/Stage.jsx'))

const WEBGL = hasWebGL()

export default function App() {
  const setSection = useStore((s) => s.setSection)
  const setTier = useStore((s) => s.setTier)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Gọi ngay ở đây, KHÔNG chờ chunk 3D: ảnh và JavaScript tải song song.
    hamNongAnh()
    setSectionListener(setSection)
    const stop = initScroll()
    const stopFps = watchFps((tier) => setTier(tier))
    // cho trình duyệt kịp vẽ khung đầu rồi mới bỏ loader
    const t = setTimeout(() => setReady(true), 400)
    return () => {
      stop()
      stopFps()
      clearTimeout(t)
    }
  }, [setSection, setTier])

  useReveal([])

  return (
    <>
      <div className={`loader ${ready ? 'gone' : ''}`} aria-hidden={ready}>
        <div className="ring" />
      </div>

      {WEBGL ? (
        <Suspense fallback={<div className="fallback-bg" />}>
          <Stage />
        </Suspense>
      ) : (
        <>
          <div className="fallback-bg" />
          <div className="fallback-note">
            Thiết bị/ứng dụng này chưa hỗ trợ hiệu ứng 3D. Mở link bằng Chrome hoặc Safari để xem
            bản đầy đủ nhé.
          </div>
        </>
      )}

      <main className="content">
        <Hero />
        <SaveTheDate />
        <Gallery />
        <Details />
        <Rsvp />
        <Outro />
      </main>

      <Progress />
      <Nav />
      <Music />
    </>
  )
}
