import { useEffect } from 'react'

// Thêm class .in cho mọi phần tử .reveal khi nó vào khung nhìn.
// Dùng IntersectionObserver thay vì nghe scroll → không tốn frame.
export function useReveal(deps = []) {
  useEffect(() => {
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

    const watch = (root) => {
      if (root.nodeType !== 1) return
      if (root.classList.contains('reveal') && !root.classList.contains('in')) io.observe(root)
      root.querySelectorAll?.('.reveal:not(.in)').forEach((el) => io.observe(el))
    }

    watch(document.body)

    // ⚠️ Phải theo dõi cả phần tử SINH RA VỀ SAU. Trước đây chỉ quét một lần lúc
    // mount, nên thẻ "Đa tạ thân hữu" của form RSVP — chỉ xuất hiện sau khi khách
    // bấm gửi — không được ai theo dõi và nằm mãi ở opacity: 0. Gửi thành công mà
    // khách không thấy gì.
    const mo = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach(watch)
    })
    mo.observe(document.body, { childList: true, subtree: true })

    // Lưới an toàn: nếu vì lý do gì đó observer không chạy (WebView lạ, JS lỗi
    // một phần), sau 3 giây cứ hiện hết ra. Thiệp cưới mà chữ không hiện là hỏng.
    const safety = setInterval(() => {
      document.querySelectorAll('.reveal:not(.in)').forEach((el) => {
        // chỉ cứu phần tử đã nằm trong hoặc trên khung nhìn, để phần dưới vẫn
        // giữ được hiệu ứng hiện dần khi cuộn tới
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('in')
      })
    }, 3000)

    return () => {
      io.disconnect()
      mo.disconnect()
      clearInterval(safety)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
