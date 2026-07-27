// node --test src/lib/rsvp.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BOTH,
  eventLabel,
  guestCount,
  buildPayload,
  isFirebaseReady,
  firestoreUrl,
  toFirestoreFields,
  wishPayload,
  wishesWriteUrl,
  wishesListUrl,
  parseWishes,
} from './rsvp.js'
import { EVENTS } from '../config.js'

const base = {
  name: ' Test Khách ',
  attend: 'yes',
  which: EVENTS[0].id,
  party: 'one',
  countOther: '3',
  wish: ' chúc mừng ',
}

test('nhãn tiệc: chọn một bên', () => {
  assert.equal(eventLabel(EVENTS[0].id, EVENTS), `${EVENTS[0].side} — ${EVENTS[0].title}`)
  assert.equal(eventLabel(EVENTS[1].id, EVENTS), `${EVENTS[1].side} — ${EVENTS[1].title}`)
})

test('nhãn tiệc: chọn CẢ HAI — không được ra "undefined"', () => {
  const label = eventLabel(BOTH, EVENTS)
  assert.equal(label, EVENTS.map((e) => `${e.side} — ${e.title}`).join(' + '))
  assert.ok(!label.includes('undefined'), label)
  assert.ok(label.includes(EVENTS[0].side) && label.includes(EVENTS[1].side))
})

test('nhãn tiệc: id lạ → rỗng, không nổ', () => {
  assert.equal(eventLabel('khong-ton-tai', EVENTS), '')
})

test('số khách', () => {
  assert.equal(guestCount('one'), 1)
  assert.equal(guestCount('two'), 2)
  assert.equal(guestCount('other', '5'), 5)
  // ô nhập tự do: mọi giá trị vô nghĩa đều phải về 1
  for (const bad of ['', '0', '-2', 'abc', null, undefined, '2.7']) {
    const n = guestCount('other', bad)
    assert.ok(n >= 1 && Number.isInteger(n), `${bad} → ${n}`)
  }
})

test('payload khi ĐI cả hai tiệc, 2 người', () => {
  const p = buildPayload({ ...base, which: BOTH, party: 'two' }, EVENTS, 'T')
  assert.equal(p.which, BOTH)
  assert.equal(p.count, 2)
  assert.ok(!p.eventLabel.includes('undefined'))
  assert.equal(p.name, 'Test Khách') // đã trim
  assert.equal(p.wish, 'chúc mừng')
})

test('payload khi KHÔNG đến: bỏ trống tiệc và số người', () => {
  const p = buildPayload({ ...base, attend: 'no', which: BOTH, party: 'two' }, EVENTS, 'T')
  assert.equal(p.which, '')
  assert.equal(p.eventLabel, '')
  assert.equal(p.count, 0)
  assert.equal(p.wish, 'chúc mừng') // lời chúc vẫn gửi
})

/* ------------------------------------------------------------- Firestore */

const FB = { projectId: 'thiep-cuoi-abc', apiKey: 'AIza-test', collection: 'rsvp' }

test('chỉ coi là đã cấu hình Firebase khi có đủ 3 ô', () => {
  assert.equal(isFirebaseReady(FB), true)
  assert.equal(isFirebaseReady(undefined), false)
  assert.equal(isFirebaseReady({}), false)
  for (const k of ['projectId', 'apiKey', 'collection']) {
    assert.equal(isFirebaseReady({ ...FB, [k]: '' }), false, `thiếu ${k} mà vẫn báo sẵn sàng`)
  }
})

test('URL Firestore đúng dạng', () => {
  const u = firestoreUrl(FB)
  assert.ok(u.startsWith('https://firestore.googleapis.com/v1/projects/thiep-cuoi-abc'))
  assert.ok(u.includes('/databases/(default)/documents/rsvp'))
  assert.ok(u.endsWith('?key=AIza-test'))
})

test('chuyển sang kiểu của Firestore REST', () => {
  const p = buildPayload(
    { ...base, which: BOTH, party: 'other', countOther: '4' },
    EVENTS,
    '2026-07-27T10:20:30.000Z',
  )
  const { fields } = toFirestoreFields(p)

  assert.deepEqual(fields.name, { stringValue: 'Test Khách' })
  // số nguyên PHẢI là chuỗi, đưa số thật vào là Firestore trả 400
  assert.deepEqual(fields.count, { integerValue: '4' })
  assert.equal(typeof fields.count.integerValue, 'string')
  // chuỗi ISO phải thành timestamp thật để còn sắp xếp được trong Firestore
  assert.deepEqual(fields.at, { timestampValue: '2026-07-27T10:20:30.000Z' })
  // các chuỗi thường không được nhận nhầm thành timestamp
  assert.ok('stringValue' in fields.eventLabel)
  assert.ok(!fields.eventLabel.stringValue.includes('undefined'))
})

test('count = 0 vẫn phải ra integerValue "0", không được rơi thành chuỗi rỗng', () => {
  const p = buildPayload({ ...base, attend: 'no' }, EVENTS, 'T')
  const { fields } = toFirestoreFields(p)
  assert.deepEqual(fields.count, { integerValue: '0' })
})

/* --------------------------------------------------- Bảng lời chúc công khai */

test('lời chúc gửi lên bảng CHỈ mang 3 trường, không lẫn thông tin tham dự', () => {
  const p = buildPayload({ ...base, which: BOTH, party: 'two' }, EVENTS, 'T')
  const w = wishPayload(p)
  // đây là chốt an toàn: bảng này đọc công khai, lẫn `attend`/`count` vào là
  // hở danh sách khách ra ngoài
  assert.deepEqual(Object.keys(w).sort(), ['at', 'name', 'wish'])
  assert.equal(w.name, 'Test Khách')
  assert.equal(w.wish, 'chúc mừng')
})

test('không viết gì thì không lưu lời chúc rỗng lên bảng', () => {
  for (const wish of ['', '   ', '\n']) {
    const p = buildPayload({ ...base, wish }, EVENTS, 'T')
    assert.equal(wishPayload(p), null, `wish=${JSON.stringify(wish)} mà vẫn lưu`)
  }
})

test('URL bảng lời chúc: collection riêng, có sắp xếp', () => {
  const w = wishesWriteUrl(FB)
  assert.ok(w.includes('/documents/wishes?key='), w)
  assert.ok(!w.includes('/documents/rsvp'), 'không được ghi vào collection rsvp')

  const l = wishesListUrl(FB, 30)
  assert.ok(l.includes('/documents/wishes?key='))
  assert.ok(l.includes('pageSize=30'))
  assert.ok(l.includes('orderBy=at%20desc'), l)
})

test('đọc bảng lời chúc: chịu được dữ liệu thiếu và collection rỗng', () => {
  // Firestore trả về `{}` khi collection chưa có document nào
  assert.deepEqual(parseWishes({}), [])
  assert.deepEqual(parseWishes(null), [])
  assert.deepEqual(parseWishes({ documents: null }), [])

  const out = parseWishes({
    documents: [
      { name: 'p/d/wishes/aaa', fields: { name: { stringValue: 'A' }, wish: { stringValue: 'x' }, at: { timestampValue: '2026-01-01T00:00:00Z' } } },
      { name: 'p/d/wishes/bbb', fields: { name: { stringValue: 'B' }, wish: { stringValue: 'y' }, at: { timestampValue: '2026-03-01T00:00:00Z' } } },
      { name: 'p/d/wishes/ccc', fields: { name: { stringValue: 'C' } } }, // thiếu wish → bỏ
      { name: 'p/d/wishes/ddd', fields: {} }, // rỗng → bỏ
      {}, // document lạ → bỏ, không được nổ
    ],
  })
  assert.equal(out.length, 2)
  assert.deepEqual(out.map((w) => w.name), ['B', 'A']) // mới nhất lên trước
  assert.equal(out[0].id, 'bbb')
})

