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
//   type: 'text'   → chữ (mọi ký tự Unicode đều được: dấu tiếng Việt, ♥, ✦, emoji…)
//   type: 'heart'  → hai trái tim tựa vào nhau
//   type: 'rings'  → đôi nhẫn lồng nhau
//   type: 'sphere' → quả cầu hạt (nhịp nghỉ giữa hai hình)
//
// Tuỳ chọn cho mỗi mục:
//   only:   'mobile' | 'desktop'   — chỉ hiện trên loại màn hình đó (bỏ trống = cả hai)
//   font:   'serif' (mặc định) | 'script'  — script = kiểu nghiêng mềm, hợp với ngày tháng
//   width:  0.3 … 1.0   — bề ngang chữ so với chiều rộng khả dụng (mặc định 1.0)
//   size:   0.5 … 1.5   — cỡ của heart / rings / sphere (mặc định 1.0)
//
// Chữ dài thì hạt bị dàn mỏng và khó đọc — nên giữ dưới ~20 ký tự mỗi dòng.
// ---------------------------------------------------------------------------
export const PARTICLE = {
  hold: 2.6, // giây giữ nguyên mỗi hình
  morph: 1.6, // giây để biến sang hình kế tiếp

  sequence: [
    { type: 'heart' },
    { type: 'rings' },

    // Màn rộng đủ chỗ cho cả hai tên trên một dòng
    { type: 'text', text: 'Lê Huy ♥ Như Trang', only: 'desktop' },

    // Màn hẹp thì tách làm hai nhịp cho chữ đủ to
    { type: 'text', text: 'Lê Huy', only: 'mobile', width: 0.8 },
    { type: 'text', text: 'Như Trang', only: 'mobile', width: 0.9 },

    { type: 'text', text: '20 · 09 · 2026', font: 'script', width: 0.75 },
    { type: 'text', text: '04 · 10 · 2026', font: 'script', width: 0.75 },

    // { type: 'sphere' },

    // Thêm chữ của bạn ở đây, ví dụ:
    // { type: 'text', text: 'Save the date', width: 0.7 },
    // { type: 'text', text: 'Chờ bạn tới nhé', font: 'script' },
  ],
}

// Hai tiệc — nhà gái và nhà trai
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
    timeLabel: '09:00 — Đón khách từ 10:30',
    venue: 'Tư gia nhà gái',
    address: '',
    mapQuery: 'Quảng Trị',
  },
  {
    id: 'nha-trai',
    side: 'Nhà trai',
    title: 'Lễ Thành Hôn',
    host: 'Gia đình chú rể Lê Huy',
    date: new Date(2026, 9, 4, 11, 0, 0),
    dateLabel: 'Chủ nhật · 04 tháng 10 năm 2026',
    lunar: 'Nhằm ngày 24 tháng 08 năm Bính Ngọ',
    timeLabel: '07:00 — Đón khách từ 11:00',
    venue: 'Tư gia nhà trai',
    address: '',
    mapQuery: 'Tp. Hồ Chí Minh',
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
    projectId: '', // ví dụ 'thiep-cuoi-huy-trang'
    apiKey: '', // Web API key trong Project settings
    collection: 'rsvp',
  },

  // ── Cách 2: Google Apps Script / Formspree ───────────────────────────────
  endpoint: '',

  // ── Cách 3 (mặc định): mở sẵn email cho khách bấm gửi ────────────────────
  // Cũng là phương án dự phòng khi hai cách trên gửi lỗi.
  email: 'huytl@cnv.vn', // ⚠️ đổi sang email bạn muốn nhận phản hồi
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
