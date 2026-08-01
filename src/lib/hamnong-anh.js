// Kéo sẵn 40 ảnh album về bộ nhớ đệm của trình duyệt, SỚM NHẤT CÓ THỂ.
//
// Vì sao cần một file riêng mà không gọi thẳng prefetchAll trong textures.js:
// textures.js `import * as THREE`. Gọi nó từ App.jsx là kéo cả three.js (683KB)
// vào chunk chính, mất luôn tác dụng của việc tách chunk. File này KHÔNG import
// gì ngoài config, nên nằm gọn trong chunk chính.
//
// Vì sao phải sớm: trước đây ảnh chỉ bắt đầu tải từ trong CurvedGallery — mà
// component đó nằm trong chunk Stage, tức là phải chờ tải + chạy xong ~800KB
// JavaScript rồi mới phát request ảnh đầu tiên. Trên điện thoại mạng yếu, đó là
// 1–3 giây ảnh nằm im không ai gọi tới. Hâm nóng ở đây thì ảnh và JavaScript
// chạy SONG SONG.
//
// Sau đó three.js gọi lại đúng URL này thì trình duyệt lấy từ bộ nhớ đệm, không
// phát thêm request nào.
import { GALLERY } from '../config.js'

// Đủ để lấp băng thông mà không giành hết của JavaScript đang tải cùng lúc.
const CUNG_LUC = 6

let daChay = false

export function hamNongAnh(urls = GALLERY.map((g) => g.src)) {
  if (daChay || typeof window === 'undefined') return
  daChay = true

  const hang = [...urls]
  let dangChay = 0

  const keo = () => {
    while (dangChay < CUNG_LUC && hang.length) {
      const src = hang.shift()
      dangChay++
      const im = new Image()
      // Hỏng thì kệ — textures.js có cơ chế thử lại riêng, đây chỉ là hâm nóng.
      im.onload = im.onerror = () => {
        dangChay--
        keo()
      }
      im.src = src
    }
  }
  keo()
}
