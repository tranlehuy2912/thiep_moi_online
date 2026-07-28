// Cầu nối từ lớp DOM (nút bấm trong form) sang canvas 3D (pháo hoa).
//
// Cùng lý do với `scrollState`: component pháo hoa đọc thẳng hàng đợi này trong
// useFrame. Đẩy qua React state thì mỗi quả pháo là một lần re-render cả cây
// component — trong khi việc duy nhất cần làm là ghi vài trăm số vào buffer.
//
// Hàng đợi chỉ mang toạ độ CHUẨN HOÁ (-1..1). Quy ra đơn vị thế giới là việc của
// component, vì chỉ ở trong Canvas mới biết khung nhìn hiện rộng cao bao nhiêu —
// mà điện thoại với máy bàn lệch nhau tới 3-4 lần.
import { PREFERS_REDUCED } from './quality.js'

export const burstQueue = []

// nx, ny : -1..1, tâm màn hình là 0. ny dương = phía trên.
// delay  : giây, tính từ lúc xếp hàng.
// tone   : 0..1, pha từ vàng nắng sang hồng cánh sen.
export function fireBurst({ nx = 0, ny = 0.4, delay = 0, tone = 0 } = {}) {
  // Giữ hàng đợi có đáy: nếu vì lý do gì đó không có ai rút (không dựng được
  // WebGL chẳng hạn) thì nó cũng không phình ra mãi.
  if (burstQueue.length > 64) return
  burstQueue.push({ nx, ny, delay, tone })
}

// Một tràng pháo mừng: vài quả nối đuôi nhau, so le hai bên cho khỏi đều tăm tắp.
//
// Toạ độ cố ý tránh giữa màn hình — chỗ đó là tấm thiệp "Đa tạ thân hữu" vừa
// hiện ra, pháo nổ sau lưng nó thì phí.
export function celebrate(count = 9) {
  // Khách đã bật "giảm chuyển động" thì thôi, đừng nổ gì cả.
  if (PREFERS_REDUCED) return

  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1
    fireBurst({
      nx: side * (0.3 + Math.random() * 0.55),
      // Sàn 0.3 chứ không phải 0.18: thấp hơn nữa là quả pháo nổ ngay sau tấm
      // thiệp "Đa tạ thân hữu" — tấm đó đục, che mất sạch.
      ny: 0.3 + Math.random() * 0.5,
      delay: i * 0.34 + Math.random() * 0.22,
      tone: Math.random() * 0.6,
    })
  }
}

// Móc gỡ lỗi khi chạy dev: gõ __celebrate() trong Console là bắn thử, khỏi phải
// gửi form thật rồi lại đi xoá bản ghi trong Firebase. Bản production không có.
if (import.meta.env?.DEV && typeof window !== 'undefined') window.__celebrate = celebrate
