// ============================================================================
//  ⭐ TOÀN BỘ NỘI DUNG THIỆP NẰM Ở FILE NÀY.
//  Sửa thiệp = sửa file này. Không cần đụng vào code khác.
// ============================================================================

export const COUPLE = {
  groom: { name: 'Lê Huy', short: 'Huy', role: 'Chú rể' },
  bride: { name: 'Như Trang', short: 'Trang', role: 'Cô dâu' },
  tagline: 'Nơi Mãi Mãi Bắt Đầu',
}

// ---------------------------------------------------------------------------
// ⭐ CHỮ & HÌNH CHẠY BẰNG HẠT Ở MÀN ĐẦU
//
// Cụm hạt sẽ lần lượt biến thành từng mục dưới đây rồi quay lại từ đầu.
// Muốn thêm chữ: chỉ cần chèn một dòng { type: 'text', text: '...' } vào danh sách.
//
//   type: 'text'     → chữ (mọi ký tự Unicode đều được: dấu tiếng Việt, ♥, ✦, emoji…)
//   type: 'heart'    → hai trái tim tựa vào nhau
//   type: 'rings'    → đôi nhẫn lồng nhau
//   type: 'monogram' → HAI CHỮ CÁI LỒNG VÀO NHAU (viết 'H ♥ T' bằng type 'text'
//                      thì hai chữ luôn rời nhau — font tự chừa khoảng cách)
//   type: 'sphere'   → quả cầu hạt (nhịp nghỉ giữa hai hình)
//
// Tuỳ chọn cho mỗi mục:
//   only:   'mobile' | 'desktop'   — chỉ hiện trên loại màn hình đó (bỏ trống = cả hai)
//   font:   'serif' (mặc định) | 'script' | 'calligraphy'
//           script = serif nghiêng mềm, hợp với ngày tháng
//           calligraphy = thư pháp thật (Italianno) — nét mảnh, dùng cho monogram
//   width:  0.3 … 1.0   — bề ngang chữ so với chiều rộng khả dụng (mặc định 1.0)
//   size:   0.5 … 1.5   — cỡ của heart / rings / sphere (mặc định 1.0)
//
// Riêng monogram:
//   left / right → hai chữ cái (mặc định 'H' và 'T')
//   style: 'script'   → chữ SERIF ĐỨNG làm nền + chữ THƯ PHÁP nét mảnh vắt lên
//                       (kiểu monogram cưới cổ điển). Dùng font Italianno.
//          'ligature' → hai chữ serif ghép sát nhau (mặc định)
//
//   ── các số dưới đây chỉ có tác dụng với style 'ligature' ──
//   overlap: 0.10 … 0.18 — chồng lên nhau bao nhiêu (mặc định 0.10).
//                          ĐỪNG hạ dưới 0.10: ở 0.06 nhìn thì tưởng dính nhưng
//                          đo ra vẫn là HAI mảng rời. Từ 0.20 trở lên thì chữ
//                          sau bị chữ trước nuốt dần.
//   heart:   0           — tim treo ở chỗ giao nhau. Đang tắt vì bị hai chữ che
//                          gần hết, chỉ còn mũi nhọn thò xuống nhìn như cái gai.
//                          Muốn có tim thì để { type: 'heart' } riêng một nhịp.
//
//   ── các số dưới đây chỉ có tác dụng với style 'script' ──
//   Muốn CẢ HAI chữ đều thư pháp thì thêm font: 'calligraphy' và đổi 3 số:
//     { type: 'monogram', left: 'H', right: 'T', style: 'script',
//       font: 'calligraphy', scriptSize: 1.0, scriptDx: 0.42, scriptDy: 0.02 }
//   Đẹp và mềm như chữ ký, nhưng nét mảnh gấp ~3 lần nên nhạt hơn trên điện thoại.
//   scriptSize: 1.7   — chữ thư pháp to hơn chữ nền bao nhiêu lần. Đừng hạ dưới
//                       ~1.4: nét thư pháp mảnh, vẽ nhỏ là hạt rắc không đủ và
//                       nét bị đứt đoạn.
//   scriptDx:   0.26  — vắt lệch sang phải bao nhiêu (theo cỡ chữ nền)
//   scriptDy:   0.14  — chữ thư pháp nằm thấp hơn chữ nền bao nhiêu.
//                       Nhỏ hơn ~0.08 là nó nhổng lên trên chữ nền, trông rời
//                       tầng; lớn hơn ~0.22 là đuôi chọc xuống dưới chân chữ.
//
// Chữ dài thì hạt bị dàn mỏng và khó đọc — nên giữ dưới ~20 ký tự mỗi dòng.
// ---------------------------------------------------------------------------
export const PARTICLE = {
  hold: 2.6, // giây giữ nguyên mỗi hình
  morph: 1.6, // giây để biến sang hình kế tiếp

  // -------------------------------------------------------------------------
  // ⭐ GỢN SÓNG — cụm hạt "thở" khi đang đứng yên giữa hai lần biến hình.
  //
  // Sóng đến từ một trường curl-noise LIỀN MẠCH, không phải rung ngẫu nhiên
  // từng hạt: các hạt cạnh nhau nhận gần đúng một hướng đẩy nên nhấp nhô THÀNH
  // CỤM, và cả trường thì trôi ngang — đó là lý do nhìn ra sóng lăn qua hình.
  //
  // Sửa mấy số này là thấy đổi ngay, không cần khởi động lại (đọc mỗi frame).
  // Đặt depth = flat = 0 là hình đứng im hoàn toàn — nhưng lúc đó nó trông
  // như ảnh PNG dán lên, mất sạch cảm giác đây là hạt thật.
  // -------------------------------------------------------------------------
  // drift: {
  //   // Biên độ theo trục Z (chiều sâu). ĐÂY là thứ tạo ra cảm giác sóng.
  //   // Z không hề vô hình: hạt xa gần thì to nhỏ khác nhau, nên sóng hiện ra ở
  //   // độ SÁNG và cỡ hạt, còn đường viền hình thì vẫn sắc. 0.03 = dịu, 0.10 = rõ.
  //   depth: 0.05,

  //   // Biên độ trong mặt phẳng XY (ngang–dọc).
  //   // ⚠️ Nét chữ chỉ dày ~0.04 đơn vị. Quá 0.02 là nét nhoè vào nhau và các góc
  //   // chữ trông méo mó ngay — đúng lỗi "nhìn cứ méo méo" đã sửa trước đây.
  //   // Muốn sóng mạnh hơn thì tăng `depth`, đừng tăng số này.
  //   flat: 0.008,

  //   // Bước sóng. Số NHỎ = sóng dài, thoải; số LỚN = lăn tăn, vụn.
  //   // 0.7 cho khoảng 4–5 nhịp trải hết một dòng chữ.
  //   scale: 0.7,

  //   // Sóng bò nhanh chậm. 0.08 ≈ một nhịp đi hết dòng chữ trong ~17 giây.
  //   speed: 0.08,

  //   // Cả cụm lắc qua lại quanh trục dọc (radian). Đây là chuyển động RIÊNG,
  //   // không phải gợn sóng — 0.22 rad ≈ 12.6°, một vòng ~52 giây. Đặt 0 để tắt.
  //   sway: 0.22,
  //   swaySpeed: 0.12,
  // },
  drift: { depth: 0, flat: 0, sway: 0 },

  sequence: [
    { type: 'heart' },
    // { type: 'rings' },

    // Màn rộng đủ chỗ cho cả hai tên trên một dòng
    { type: 'text', text: 'Lê Huy ♥ Như Trang', only: 'desktop' },

    // Màn hẹp thì tách làm hai nhịp cho chữ đủ to
    { type: 'text', text: 'Lê Huy', only: 'mobile', width: 0.8 },
    { type: 'text', text: 'Như Trang', only: 'mobile', width: 0.9 },

    { type: 'text', text: '20 · 09 · 2026', font: 'script', width: 0.75 },
    { type: 'text', text: '04 · 10 · 2026', font: 'script', width: 0.75 },

    { type: 'text', text: '囍', width: 0.45 },     // song hỷ
    { type: 'text', text: '❀', width: 0.4 },
    { type: 'text', text: '∞', width: 0.5 },
    { type: 'text', text: '🕊', width: 0.45 },     // bồ câu
    // { type: 'monogram', left: 'H', right: 'T', style: 'script', width: 0.45 },
    { type: 'monogram', left: 'H', right: 'T', style: 'script', font: 'calligraphy', scriptSize: 1.7, scriptDx: 0.25, scriptDy: 0.02, width: 0.45 },
    // { type: 'sphere' },

    // Thêm chữ của bạn ở đây, ví dụ:
    // { type: 'text', text: 'Save the date', width: 0.7 },
    // { type: 'text', text: 'Chờ bạn tới nhé', font: 'script' },
  ],
}

// Hai tiệc — nhà gái và nhà trai
//
// `place` là tên địa điểm NGẮN, chỉ dùng ở màn mở đầu (hero) dưới mỗi ngày.
// Tách riêng khỏi `venue` vì hero cần gọn: nhồi cả địa chỉ đầy đủ vào đó là
// nặng màn mở đầu, mà địa chỉ đầy đủ thì đã có ở màn "Hồi sau" rồi.
// Bỏ trống `place` thì hero tự lấy `mapQuery`; bỏ cả hai thì hero không hiện dòng đó.
export const EVENTS = [
  {
    id: 'nha-gai',
    side: 'Nhà gái',
    title: 'Lễ Vu Quy',
    host: 'Gia đình cô dâu Như Trang',
    // Tháng trong JS đếm từ 0 → 8 = tháng 9
    date: new Date(2026, 8, 20, 11, 0, 0),
    dateLabel: 'Chủ nhật · 20 tháng 09 năm 2026',
    lunar: 'Nhằm ngày 10 tháng 08 năm Bính Ngọ',
    timeLabel: '10:30',
    venue: 'Thôn Mỹ Thủy, xã Mỹ Thủy, tỉnh Quảng Trị',
    place: 'Mỹ Thủy · Quảng Trị', // tên ngắn cho màn mở đầu
    coords: '16.774916,107.335467',
    mapQuery: 'Quảng Trị', // chỉ dùng khi KHÔNG có coords
  },
  {
    id: 'nha-trai',
    side: 'Nhà trai',
    title: 'Lễ Thành Hôn',
    host: 'Gia đình chú rể Lê Huy',
    date: new Date(2026, 9, 4, 11, 0, 0),
    dateLabel: 'Chủ nhật · 04 tháng 10 năm 2026',
    lunar: 'Nhằm ngày 24 tháng 08 năm Bính Ngọ',
    timeLabel: '11:00',
    venue: 'Nhà Hàng Tiệc Cưới - Trung Tâm Hội Nghị Hương Phố',
    place: 'Hương Phố · TP. Hồ Chí Minh', // tên ngắn cho màn mở đầu
    coords: '10.828742101212985,106.68334925775166',
    mapQuery: 'Tp. Hồ Chí Minh', // chỉ dùng khi KHÔNG có coords
  },
]

// Album ảnh cưới.
// Ảnh nằm ở public/photos/album-1.webp … album-N.webp
// Thêm/bớt ảnh: chạy lại `node scripts/optimize-photos.mjs <thư-mục-ảnh>` rồi đổi số dưới đây.
export const GALLERY_COUNT = 40
export const GALLERY = Array.from({ length: GALLERY_COUNT }, (_, i) => ({
  src: `./photos/album-${i + 1}.webp`,
  caption: `Khoảnh khắc ${i + 1}`,
}))

// Xác nhận tham dự. Form thử lần lượt 3 cách, cách nào cấu hình trước thì dùng
// cách đó. Hướng dẫn từng bước trong README, mục "Nhận phản hồi RSVP".
export const RSVP = {
  // ── Cách 1 (khuyên dùng): Firebase Firestore ──────────────────────────────
  // Không cần cài SDK, gọi thẳng REST. Điền đủ 3 ô dưới là chạy.
  // ⚠️ Nhớ đặt Security Rules như README hướng dẫn, nếu không sẽ bị chặn ghi
  //    (hoặc tệ hơn: ai cũng đọc/xoá được danh sách khách).
  firebase: {
    projectId: 'wedding-29ced',
    apiKey: 'AIzaSyDxvgg7B9xE4AKDdJW_36XVkXm0tJI7I38',
    collection: 'rsvp',
  },

  // ── Cách 2: Google Apps Script / Formspree ───────────────────────────────
  endpoint: '',

  // Không cấu hình cách nào ở trên → form báo lỗi "Tín hiệu trục trặc bất
  // thành" kèm nút Thử lại. KHÔNG có phương án email dự phòng: `mailto:` chỉ mở
  // app mail rồi trông chờ khách tự bấm Gửi, mà trong WebView Zalo/Messenger
  // (nơi phần lớn khách mở link) nó thường không mở gì cả → mất hồi âm.
}

// Mừng cưới — bật lên sau khi điền số tài khoản thật.
export const GIFT = {
  enabled: false,
  accounts: [
    { label: 'Chú rể Lê Huy', bank: 'VCB', bankName: 'Vietcombank', number: '0000000000', holder: 'LE HUY' },
    { label: 'Cô dâu Như Trang', bank: 'TCB', bankName: 'Techcombank', number: '0000000000', holder: 'NHU TRANG' },
  ],
}

export const MUSIC = {
  src: './audio/nhac.mp3', // thả file mp3 vào public/audio/ — thiếu file thì nút nhạc tự ẩn
  volume: 0.45,
}

// Bảng màu lấy từ poster cưới
export const PALETTE = {
  skyDeep: '#08161F',
  skyMid: '#123B50',
  skyWarm: '#8A7A62',
  sun: '#FFD79A',
  gold: '#E7BE72',
  goldDeep: '#B4832F',
  goldLight: '#F7E4B4',
  cream: '#F6EFE1',
  petal: '#E9B0A4',
  ink: '#0A1A22',
}

// Các màn của trang, theo đúng thứ tự cuộn
export const SECTIONS = [
  { id: 'hero', label: 'Mở đầu' },
  { id: 'save', label: 'Save the date' },
  { id: 'gallery', label: 'Album' },
  { id: 'details', label: 'Hôn lễ' },
  { id: 'rsvp', label: 'Xác nhận tham dự' },
  { id: 'outro', label: 'Lời cảm ơn' },
]
