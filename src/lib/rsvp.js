// Phần logic thuần của form RSVP, tách khỏi React để test được bằng Node:
//   node --test src/lib/rsvp.test.mjs

// Giá trị riêng cho lựa chọn "đi cả hai tiệc" — cố ý không trùng id nào trong EVENTS
export const BOTH = 'both'

// Ghép nhãn buổi tiệc để gửi vào email / Google Sheet.
// Chỗ này từng là nguồn lỗi: khi chọn BOTH thì không có event nào khớp id, nếu
// cứ `EVENTS.find(...)` rồi nội suy thì ra "undefined — undefined".
export function eventLabel(which, events) {
  if (which === BOTH) return events.map((e) => `${e.side} — ${e.title}`).join(' + ')
  const ev = events.find((e) => e.id === which)
  return ev ? `${ev.side} — ${ev.title}` : ''
}

// Số khách quy từ lựa chọn ở câu 4.
export function guestCount(party, other) {
  if (party === 'one') return 1
  if (party === 'two') return 2
  const n = Math.floor(Number(other))
  // ô "số lượng khác" là input tự do: rỗng, chữ, số âm, 0 đều phải rơi về 1
  return Number.isFinite(n) && n >= 1 ? n : 1
}

// Dữ liệu cuối cùng gửi đi. Khách không đến thì hai câu về tiệc và số người
// là vô nghĩa → gửi rỗng thay vì gửi giá trị mặc định gây hiểu sai.
export function buildPayload(form, events, now) {
  const going = form.attend === 'yes'
  return {
    name: form.name.trim(),
    attend: form.attend,
    which: going ? form.which : '',
    eventLabel: going ? eventLabel(form.which, events) : '',
    count: going ? guestCount(form.party, form.countOther) : 0,
    wish: form.wish.trim(),
    at: now,
  }
}

// ===========================================================================
//  Firebase Firestore qua REST
//
//  Cố ý KHÔNG cài SDK firebase: gói firestore nặng ~90KB gzip, gần bằng nửa
//  bundle three.js, chỉ để ghi một document cho mỗi khách. REST chỉ là một
//  lệnh fetch — 0 byte thêm vào bundle, và có CORS nên đọc được cả kết quả trả
//  về (khác hẳn Apps Script phải chạy no-cors, gửi xong mù tịt không biết
//  thành công hay không).
// ===========================================================================

export function isFirebaseReady(fb) {
  return !!(fb && fb.projectId && fb.apiKey && fb.collection)
}

function docsBase(fb, collection) {
  return (
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(fb.projectId)}` +
    `/databases/(default)/documents/${encodeURIComponent(collection)}`
  )
}

export function firestoreUrl(fb) {
  return `${docsBase(fb, fb.collection)}?key=${encodeURIComponent(fb.apiKey)}`
}

// ---------------------------------------------------------------------------
//  BẢNG LỜI CHÚC — collection RIÊNG, tách hẳn khỏi `rsvp`
//
//  Không dùng chung một collection và mở quyền đọc, vì `rsvp` chứa cả danh sách
//  khách: ai đến, ai không, đi mấy người. Mở đọc collection đó ra là bất kỳ ai
//  có link thiệp đều tải về được toàn bộ danh sách khách mời.
//
//  `wishes` chỉ mang 3 trường — tên và lời chúc, những thứ vốn dĩ để cho mọi
//  người đọc. Cho đọc công khai đúng collection này là an toàn.
// ---------------------------------------------------------------------------
export const WISHES_COLLECTION = 'wishes'

// Trả về null nếu khách không viết gì — không lưu lời chúc rỗng lên bảng.
export function wishPayload(payload) {
  const wish = (payload.wish || '').trim()
  if (!wish) return null
  return { name: payload.name, wish, at: payload.at }
}

export function wishesWriteUrl(fb) {
  return `${docsBase(fb, WISHES_COLLECTION)}?key=${encodeURIComponent(fb.apiKey)}`
}

export function wishesListUrl(fb, pageSize = 60) {
  // orderBy của Firestore REST cần khoảng trắng đã encode: "at desc"
  return (
    `${docsBase(fb, WISHES_COLLECTION)}?key=${encodeURIComponent(fb.apiKey)}` +
    `&pageSize=${pageSize}&orderBy=${encodeURIComponent('at desc')}`
  )
}

// Đọc ngược từ kiểu tường minh của Firestore về object thường.
// Viết phòng thủ: collection rỗng thì Firestore trả về `{}` chứ không có
// `documents`, và document cũ có thể thiếu trường.
export function parseWishes(json) {
  const docs = json && Array.isArray(json.documents) ? json.documents : []
  return docs
    .map((d) => {
      const f = (d && d.fields) || {}
      return {
        id: typeof d.name === 'string' ? d.name.split('/').pop() : '',
        name: f.name?.stringValue || '',
        wish: f.wish?.stringValue || '',
        at: f.at?.timestampValue || '',
      }
    })
    .filter((w) => w.wish && w.name)
    // sắp lại ở client: orderBy có thể im lặng bỏ qua document thiếu trường `at`
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
}

// Firestore REST đòi kiểu tường minh cho từng trường: {"stringValue": "..."}.
// Số nguyên phải là CHUỖI ("integerValue": "2") — đưa số thật vào là 400.
export function toFirestoreFields(payload) {
  const fields = {}
  for (const [k, v] of Object.entries(payload)) {
    if (typeof v === 'number' && Number.isInteger(v)) fields[k] = { integerValue: String(v) }
    else if (typeof v === 'number') fields[k] = { doubleValue: v }
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v }
    else if (v == null) fields[k] = { nullValue: null }
    // chuỗi ISO 8601 → timestamp thật, để sắp xếp/lọc được trong Firestore
    else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(v))
      fields[k] = { timestampValue: v }
    else fields[k] = { stringValue: String(v) }
  }
  return { fields }
}

