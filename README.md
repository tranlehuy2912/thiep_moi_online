# Thiệp cưới 3D — Lê Huy ♥ Như Trang

Trang thiệp cưới online, một trang cuộn dọc, nền là cảnh 3D chạy WebGL (three.js +
React-Three-Fiber). Tông màu lấy từ poster cưới: navy-teal sâu · vàng kim · nắng hoàng hôn ·
cánh hoa hồng.

```bash
cd thiep_cuoi
npm install
npm run dev      # http://localhost:5180
npm run build    # ra thư mục dist/  → deploy thẳng lên Vercel / Netlify / Cloudflare Pages
```

**5 màn, cuộn dọc:** Mở đầu → Save the date → Album → Hôn lễ → Cảm ơn.
Không có màn "mở thiệp", vào là thấy nội dung ngay.

---

## ⭐ Sửa nội dung thiệp: chỉ cần 1 file

Toàn bộ tên, ngày giờ, địa chỉ, chữ chạy bằng hạt, số tài khoản… nằm trong
**[`src/config.js`](src/config.js)**. Không cần đụng vào code nào khác.

Những chỗ **bắt buộc** phải sửa trước khi gửi cho khách:

| Trong `src/config.js` | Đang là | Cần đổi thành |
|---|---|---|
| `EVENTS[].venue` / `.address` | “Cập nhật địa chỉ trong src/config.js” | địa chỉ thật |
| `EVENTS[].mapQuery` | `'Hà Nội'` | tên/địa chỉ để Google Maps tìm đúng |
| `EVENTS[].lunar` | ngày âm tạm tính | ngày âm đúng |
| `EVENTS[].timeLabel` | 11:00 | giờ thật |
| `GIFT.enabled` | `false` | `true` sau khi điền số tài khoản thật |
| `RSVP.firebase` | trống | điền để lưu phản hồi vào Firestore (xem bên dưới) |

---

## Nhận phản hồi RSVP

Form thử lần lượt 3 cách, cách nào được cấu hình trước thì dùng cách đó:

| | Cách | Cấu hình ở `RSVP` | Kiểm được lỗi? |
|---|---|---|---|
| 1 | **Firebase Firestore** ⭐ | `firebase.projectId` + `apiKey` + `collection` | ✅ có |
| 2 | Google Apps Script / Formspree | `endpoint` | ❌ không |

**Phải cấu hình một trong hai.** Không cấu hình gì thì form báo lỗi *"Tín hiệu trục trặc
bất thành"* kèm nút Thử lại — và ghi lý do vào console cho bạn thấy.

Cố ý **không** có phương án email dự phòng. `mailto:` không gửi gì cả, nó chỉ mở app mail
rồi trông chờ khách tự bấm Gửi — mà trong WebView Zalo/Messenger (nơi phần lớn khách mở
link) nó thường không mở gì. Tệ hơn nữa là trang không thể biết khách đã bấm Gửi hay chưa,
nên chỉ còn cách hiện "đã nhận được" một cách vô căn cứ.

Nguyên tắc ở đây: **chỉ hiện lời cảm ơn khi thật sự ghi được dữ liệu.**

### ⭐ Cách 1 — Firebase Firestore

**Không cần cài SDK firebase.** Gói `firebase/firestore` nặng ~90KB gzip, gần bằng nửa
bundle three.js của cả trang, chỉ để ghi một document cho mỗi khách. Ở đây gọi thẳng REST
API → **0 byte thêm vào bundle**, và vì Firestore có CORS nên đọc được kết quả trả về
(sai rules hay sai `projectId` là biết ngay).

1. [console.firebase.google.com](https://console.firebase.google.com) → tạo project
2. `Build` → `Firestore Database` → `Create database` → chọn region **asia-southeast1**
   (Singapore, gần Việt Nam nhất)
3. `Project settings` → phần **Your apps** → thêm Web app → copy `projectId` và `apiKey`
4. Điền vào `src/config.js`:

   ```js
   firebase: {
     projectId: 'thiep-cuoi-huy-trang',
     apiKey: 'AIzaSy...',
     collection: 'rsvp',
   },
   ```

5. **Đặt Security Rules** — bước này bắt buộc, `Firestore Database` → tab `Rules`:

   ```js
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /rsvp/{doc} {
         // chỉ cho GHI THÊM, và phải đúng dạng
         allow create: if request.resource.data.keys().hasOnly(
                            ['name','attend','which','eventLabel','count','wish','at'])
                       && request.resource.data.name is string
                       && request.resource.data.name.size() > 0
                       && request.resource.data.name.size() < 100
                       && request.resource.data.wish.size() < 1000
                       && request.resource.data.count is int
                       && request.resource.data.count >= 0
                       && request.resource.data.count <= 20;
         // KHÔNG cho đọc / sửa / xoá từ phía web
         allow read, update, delete: if false;
       }
     }
   }
   ```

   ⚠️ Đừng dùng chế độ test mode mặc định (`allow read, write: if true`): `apiKey` nằm
   công khai trong mã nguồn trang, ai xem cũng thấy — với rules mở, người ta **đọc được
   toàn bộ danh sách khách và xoá sạch**. Rules trên chỉ cho ghi thêm, giới hạn đúng 7
   trường và giới hạn độ dài, nên trường hợp xấu nhất chỉ là bị chèn rác — mà bạn xoá
   được trong console.

6. **Kiểm tra ngay bằng một lệnh** — không phải mở form trên điện thoại:

   ```bash
   npm run test:rsvp
   ```

   Script gửi thử một bản ghi `[TEST]` lên Firestore rồi báo kết quả. Nếu lỗi, nó dịch
   luôn mã lỗi: `404` = sai `projectId` hoặc chưa bấm Create database · `403` = rules
   đang chặn · `401` = sai `apiKey` · `400` = sai kiểu dữ liệu.

   Script cũng thử **xoá** bản ghi thử. Xoá **không** được là dấu hiệu tốt — nghĩa là
   rules đang chặn delete đúng như mong muốn. Nếu xoá được, rules của bạn còn quá lỏng.

7. Xem phản hồi: mở `Firestore Database` → collection `rsvp`. Muốn xuất Excel thì
   `⋮` → `Export collection`, hoặc dùng tiện ích **Firestore to Google Sheets**.

Gói Spark (miễn phí) cho 20.000 lượt ghi/ngày — thừa sức cho một đám cưới.

### Cách 2 — Google Apps Script

1. Tạo Google Sheet mới → `Tiện ích mở rộng` → `Apps Script`
2. Dán:

   ```js
   function doPost(e) {
     const d = JSON.parse(e.postData.contents)
     SpreadsheetApp.getActiveSheet().appendRow([
       new Date(), d.name, d.attend, d.eventLabel, d.count, d.wish,
     ])
     return ContentService.createTextOutput('ok')
   }
   ```

3. `Triển khai` → `Ứng dụng web` → Ai có quyền truy cập: **Bất kỳ ai**
4. Copy URL → dán vào `RSVP.endpoint` trong `src/config.js`

Form gửi bằng `mode: 'no-cors'` + `Content-Type: text/plain` — đây là kiểu duy nhất không
bị chặn preflight, và cũng đúng thứ Apps Script đọc được ở `e.postData.contents`. Đổi lại,
`no-cors` nghĩa là trình duyệt **không cho đọc kết quả**, nên gửi xong không biết Sheet có
nhận được hay không. Đây là lý do cách 1 tốt hơn.

### Test phần logic

```bash
npm test
```

Chạy `src/lib/rsvp.test.mjs` — kiểm nhãn tiệc (kể cả lựa chọn "cả 2 tiệc"), quy đổi số
khách, và việc chuyển sang kiểu dữ liệu của Firestore REST (số nguyên **phải** là chuỗi,
đưa số thật vào là Firestore trả 400).

> Cố ý **không** có "bảng lời chúc" hiện trên trang. Không có backend thì bảng đó chỉ đọc
> được từ `localStorage` của chính máy khách — mỗi người chỉ thấy lời chúc của mình, trông
> như trang bị lỗi. Ô nhập lời chúc vẫn có và vẫn được gửi kèm phản hồi.

---

## ⭐ Thêm chữ cho hiệu ứng hạt

Cụm hạt ở màn đầu lần lượt biến thành từng mục trong `PARTICLE.sequence`
(`src/config.js`) rồi quay lại từ đầu. **Muốn thêm chữ chỉ cần chèn một dòng:**

```js
export const PARTICLE = {
  hold: 2.6,   // giây giữ nguyên mỗi hình
  morph: 1.6,  // giây để biến sang hình kế tiếp

  sequence: [
    { type: 'heart' },
    { type: 'rings' },
    { type: 'text', text: 'Lê Huy ♥ Như Trang', only: 'desktop' },
    { type: 'text', text: 'Lê Huy',    only: 'mobile', width: 0.8 },
    { type: 'text', text: 'Như Trang', only: 'mobile', width: 0.9 },
    { type: 'text', text: '20 · 09 · 2026', font: 'script', width: 0.75 },
    { type: 'text', text: '04 · 10 · 2026', font: 'script', width: 0.75 },
    { type: 'sphere' },

    // ↓ thêm của bạn ở đây
    { type: 'text', text: 'Save the date', width: 0.7 },
  ],
}
```

| Khoá | Giá trị | Ý nghĩa |
|---|---|---|
| `type` | `'text'` | chữ — mọi ký tự Unicode đều được (dấu tiếng Việt, ♥, ✦, emoji) |
| | `'heart'` | hai trái tim tựa vào nhau |
| | `'rings'` | đôi nhẫn lồng nhau |
| | `'sphere'` | quả cầu hạt, dùng làm nhịp nghỉ |
| `only` | `'mobile'` / `'desktop'` | chỉ hiện trên loại màn hình đó (bỏ trống = cả hai) |
| `font` | `'serif'` (mặc định) / `'script'` | script nghiêng mềm, hợp với ngày tháng |
| `width` | `0.3` … `1.0` | bề ngang chữ so với chiều rộng khả dụng |
| `size` | `0.5` … `1.5` | cỡ của heart / rings / sphere |

Chữ càng dài thì hạt càng bị dàn mỏng và khó đọc — **nên giữ dưới ~20 ký tự mỗi dòng**,
và trên điện thoại thì dưới ~12. Chữ tự co để luôn nằm gọn trong khung hình, bạn không phải
tự canh cỡ.

Chữ được vẽ ra canvas 2D rồi quét pixel (không dùng `TextGeometry`), nên dấu tiếng Việt
luôn hiện đúng, không cần font đặc biệt nào.

---

## Ảnh: đưa vào và nén

Album hiện đọc `public/photos/album-1.webp … album-40.webp`.

Thay bộ ảnh khác — trỏ script vào thư mục ảnh gốc, nó tự resize + nén + đánh số:

```bash
node scripts/optimize-photos.mjs "/đường/dẫn/tới/thư-mục-ảnh"
```

Rồi đổi `GALLERY_COUNT` trong `src/config.js` cho khớp số ảnh.

Tuỳ chọn:

```bash
node scripts/optimize-photos.mjs "/thư-mục" --max=1600 --q=82   # nét hơn, nặng hơn
node scripts/optimize-photos.mjs "/thư-mục" --avif              # xuất thêm bản .avif
```

Bộ ảnh hiện tại: **40 tấm, 383MB → 1.7MB** (WebP, cạnh dài 1200px, ~42KB/ảnh).
Script cũng tự tạo `og.jpg` (1200×630) — ảnh hiện khi share Zalo/Messenger.

Album **không tải hết 40 ảnh cùng lúc**: mỗi tấm chỉ được tải khi sắp lọt vào tầm nhìn.
Nếu tải hết một lượt, riêng bộ nhớ GPU đã hơn 150MB và điện thoại sẽ đứng.

### Chỉnh độ nhạy khi vuốt album

Ba hằng số ở đầu [`src/three/CurvedGallery.jsx`](src/three/CurvedGallery.jsx):

| Hằng số | Hiện tại | Ý nghĩa |
|---|---|---|
| `GAIN` | `0.0165` | Kéo bao nhiêu pixel thì sang một ảnh: `GAP / GAIN` ≈ **130px**. Tăng GAIN → nhẹ tay hơn |
| `PROJECT` | `0.12` | Lúc thả tay, chiếu vị trí về trước bấy nhiêu giây theo vận tốc. Tăng → vuốt nhẹ đi xa hơn |
| `AUTO_MS` | `4500` | Không ai chạm bấy nhiêu ms thì album tự sang ảnh |

Ảnh **luôn dừng thẳng**: dãy ảnh damp về một `target` là bội số của `GAP`, không
dùng quán tính trôi tự do rồi mới kéo về.

### Nhạc nền

Thả `nhac.mp3` vào `public/audio/` (~2 phút, ≤ 2MB). Thiếu file thì nút nhạc tự ẩn.
Nhạc bắt đầu ở lần chạm/gõ phím đầu tiên của khách — trình duyệt không cho phát trước đó.
Nút tròn góc dưới trái để bật/tắt.

---

## Các kỹ thuật 3D đang dùng

Catalog đầy đủ 18 kỹ thuật + code mẫu: [KY-THUAT-3D.md](KY-THUAT-3D.md).

| Kỹ thuật | File | Ghi chú |
|---|---|---|
| **Particle Morphing** | `three/ParticleMorph.jsx` | 1 draw call, morph trong vertex shader, có stagger + curl-noise bulge. Chuỗi hình đọc từ `PARTICLE.sequence` |
| **Text → Particle** | `lib/shapes.js` | Vẽ chữ ra canvas 2D rồi quét pixel; chữ tự co vừa khung |
| **Nền procedural** | `three/Backdrop.jsx` | Trời hoàng hôn + mây fbm + tia nắng, 1 fullscreen quad, 0 byte asset |
| **Album cong** | `three/CurvedGallery.jsx` | Khung ăn theo tỉ lệ ảnh thật, kéo có quán tính + snap + RGB-shift, tải ảnh theo nhu cầu |
| **Nhẫn cưới vàng** | `three/Rings.jsx` | `metalness = 1` — vẻ lấp lánh đến từ env map |
| **Env map tự dựng** | `three/GoldEnvironment.jsx` | Canvas 2D → PMREM. Không tải HDR từ CDN |
| **Cánh hoa rơi** | `three/Petals.jsx` | InstancedMesh, chuyển động là hàm thuần theo thời gian, không physics |
| **Đom đóm / bụi sáng** | `three/Fireflies.jsx` | Points + curl noise + nhấp nháy lệch pha |
| **Post-processing** | `three/Stage.jsx` | Bloom + Chromatic Aberration + Vignette |

### Tự điều chỉnh theo máy

`src/lib/quality.js` dò cấu hình rồi chọn mức `low / mid / high` (14k → 70k hạt, DPR, số
cánh hoa). Đo FPS 4 giây đầu, tụt dưới 38fps thì tự hạ một bậc. Tôn trọng
`prefers-reduced-motion`: tắt hạt và cánh hoa.

### Không có WebGL thì sao?

WebView trong Zalo/Messenger đôi khi chặn hoặc giảm WebGL — mà đó lại là nơi phần lớn khách
sẽ mở link. Trường hợp đó trang tự chuyển sang nền gradient CSS, mọi chữ và thông tin vẫn
đầy đủ, kèm một dòng gợi ý mở bằng Chrome/Safari.

---

## Cấu trúc

```
src/
├── config.js            ⭐ toàn bộ nội dung thiệp + chuỗi chữ hạt
├── store.js             zustand: đang ở màn nào, nhạc bật/tắt
├── App.jsx              ghép canvas 3D (nền, cố định) + lớp HTML (cuộn, đè lên)
├── styles.css           bảng màu + typography
├── lib/
│   ├── scroll.js        trạng thái cuộn dùng chung (KHÔNG để trong React state)
│   ├── quality.js       dò cấu hình máy, đo FPS
│   ├── shapes.js        sinh đám mây điểm cho hệ hạt
│   ├── textures.js      ảnh giữ chỗ + tải ảnh theo nhu cầu
│   ├── calendar.js      Google Calendar / chỉ đường / đếm ngược
│   └── useReveal.js     hiệu ứng hiện dần khi cuộn tới
├── three/               các cảnh 3D (xem bảng trên)
└── ui/
    ├── Sections.jsx     toàn bộ nội dung HTML của 5 màn
    └── Chrome.jsx       thanh tiến độ, nav dots, nút nhạc

scripts/optimize-photos.mjs   resize + nén ảnh cưới sang WebP/AVIF
```

Quy ước góc giống repo game3: **0° = +Z · 90° = +X · 180° = −Z · −90° = −X**.

---

## Lưu ý khi phát triển

- **Sửa nhiều file liên tiếp → HMR áp từng phần → có thể trắng màn / mất hạt.**
  Đây là trạng thái trung gian, **F5 là sạch**. Chỉ lo nếu lỗi lặp lại sau một lần reload sạch.
- Khi chạy dev có hai móc gỡ lỗi trong console (bản production không có):
  `__store.getState().setSection(2)` để nhảy nhanh tới một màn, và `__scene`
  là scene three.js để soi thẳng các object.
- Muốn kiểm tra chất lượng đám hạt ghép chữ, đo bằng số thay vì nhìn bằng mắt:
  chiếu đám điểm về lại mặt nạ chữ rồi tính **coverage** (bao nhiêu % nét chữ
  được hạt phủ) và **spill** (bao nhiêu % hạt rơi ra ngoài nét). Hiện tại
  coverage ≈ 98.7%, spill ≈ 2% (spill chính là viền anti-alias, có là đúng).
- Trước khi gửi link cho khách: mở thử **trong app Zalo và Messenger** trên điện thoại thật,
  không chỉ Chrome desktop.
