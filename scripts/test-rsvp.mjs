// Gửi thử một phản hồi RSVP lên Firestore để kiểm tra cấu hình.
//
//   node scripts/test-rsvp.mjs
//   node scripts/test-rsvp.mjs --keep     (giữ lại document, mặc định là xoá đi)
//
// Dùng sau khi điền RSVP.firebase trong src/config.js. Kiểm được cả 3 thứ dễ sai:
// projectId, apiKey và Security Rules — mà không phải mở form trên điện thoại.
import { RSVP, EVENTS } from '../src/config.js'
import { BOTH, buildPayload, isFirebaseReady, firestoreUrl, toFirestoreFields } from '../src/lib/rsvp.js'

const keep = process.argv.includes('--keep')

if (!isFirebaseReady(RSVP.firebase)) {
  console.error('✗ Chưa cấu hình RSVP.firebase trong src/config.js')
  console.error('  Cần đủ 3 ô: projectId, apiKey, collection. Xem README mục "Nhận phản hồi RSVP".')
  process.exit(1)
}

const payload = buildPayload(
  {
    name: '[TEST] Gửi thử từ script',
    attend: 'yes',
    which: BOTH,
    party: 'two',
    countOther: '2',
    wish: 'Đây là bản ghi thử, xoá đi được.',
  },
  EVENTS,
  new Date().toISOString(),
)

const url = firestoreUrl(RSVP.firebase)
console.log(`→ POST ${url.replace(/key=.*/, 'key=***')}`)
console.log(`  ${JSON.stringify(payload)}\n`)

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(toFirestoreFields(payload)),
})

const text = await res.text()

if (res.ok) {
  const doc = JSON.parse(text)
  console.log('✓ Ghi thành công. Firestore đã nhận phản hồi.')
  console.log(`  Document: ${doc.name.split('/documents/')[1]}`)

  if (!keep) {
    // Xoá cần quyền delete — rules trong README cố tình CHẶN, nên bước này
    // thường thất bại. Đó là dấu hiệu TỐT: nghĩa là rules đang chặt.
    const del = await fetch(`https://firestore.googleapis.com/v1/${doc.name}?key=${RSVP.firebase.apiKey}`, {
      method: 'DELETE',
    })
    if (del.ok) {
      console.log('  Đã xoá bản ghi thử.')
      console.log('\n⚠️  Xoá được nghĩa là rules đang CHO PHÉP xoá từ ngoài internet.')
      console.log('   Ai cũng có thể xoá sạch danh sách khách. Xem lại Security Rules trong README.')
    } else {
      console.log('  Không xoá được bản ghi thử — đúng như mong đợi, rules đang chặn delete.')
      console.log('  Bạn vào Firebase Console xoá tay bản ghi "[TEST]" này nhé.')
    }
  }
  process.exit(0)
}

console.error(`✗ Firestore trả về ${res.status}\n${text}\n`)
const hint = {
  400: 'Sai định dạng dữ liệu. Thường do kiểu trường không khớp (số nguyên phải là chuỗi).',
  401: 'apiKey sai hoặc bị hạn chế. Kiểm tra Project settings → Web API key.',
  403: 'Security Rules đang chặn. Vào Firestore → tab Rules, dán rules trong README.',
  404: 'Không tìm thấy database. Sai projectId, hoặc chưa bấm "Create database" trong Firestore.',
}[res.status]
if (hint) console.error(`→ ${hint}`)
process.exit(1)
