import { useEffect } from 'react'

// Thêm class .in cho mọi phần tử .reveal khi nó vào khung nhìn.
// Dùng IntersectionObserver thay vì nghe scroll → không tốn frame.
export function useReveal(deps = []) {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal:not(.in)')
    if (!els.length) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        })
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    )
    els.forEach((el) => io.observe(el))

    // Lưới an toàn: nếu vì lý do gì đó observer không chạy (WebView lạ, JS lỗi
    // một phần), sau 3 giây cứ hiện hết ra. Thiệp cưới mà chữ không hiện là hỏng.
    const safety = setTimeout(() => {
      document.querySelectorAll('.reveal:not(.in)').forEach((el) => el.classList.add('in'))
    }, 3000)

    return () => {
      io.disconnect()
      clearTimeout(safety)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
