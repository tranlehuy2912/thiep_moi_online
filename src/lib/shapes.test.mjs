// node --test src/lib/shapes.test.mjs
//
// Chỉ test được phần TOÁN THUẦN của shapes.js. Các hàm sinh hạt cần canvas 2D
// nên phải kiểm trong trình duyệt, không chạy được ở Node.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ringCrossings,
  ringsAreLinked,
  RING_LINK,
  RING_LINK_SOLID,
  heartOutline,
  HEART_W,
  HEART_H,
} from './shapes.js'

// Cả hai bộ tham số đều phải lồng: bản hạt ở màn hero, bản kim loại ở màn cuối.
for (const [ten, cfg] of [
  ['bản hạt (RING_LINK)', RING_LINK],
  ['bản kim loại (RING_LINK_SOLID)', RING_LINK_SOLID],
]) {
  test(`${ten}: hai nhẫn THỰC SỰ lồng vào nhau`, () => {
    const [near, far] = ringCrossings(cfg.dx)
    const hole = 1 - cfg.tube
    const outer = 1 + cfg.tube

    // một điểm xuyên nằm lọt trong lỗ nhẫn A…
    assert.ok(near < hole, `điểm xuyên gần ở ${near}, phải nhỏ hơn lỗ ${hole}`)
    // …điểm còn lại nằm hẳn ngoài vành
    assert.ok(far > outer, `điểm xuyên xa ở ${far}, phải lớn hơn vành ${outer}`)
    assert.equal(ringsAreLinked(cfg), true)

    // nghiêng phải khác 0, không thì hai nhẫn đồng phẳng và mất hẳn tính lồng
    assert.ok(Math.abs(cfg.tiltB) > 0.1, 'góc nghiêng quá nhỏ')
  })
}

test('không lồng khi hai nhẫn quá xa hoặc trùng tâm', () => {
  const tube = RING_LINK.tube
  assert.equal(ringsAreLinked({ dx: 0, tube }), false, 'trùng tâm thì chỉ là hai vòng đồng tâm')
  assert.equal(ringsAreLinked({ dx: 2.2, tube }), false, 'quá xa thì rời hẳn nhau')
  assert.equal(ringsAreLinked({ dx: 1.95, tube }), false, 'điểm xuyên gần đã ra ngoài lỗ')
})

test('khoảng dx còn lồng được — để sau này chỉnh dáng vẫn biết giới hạn', () => {
  const tube = RING_LINK.tube
  const ok = []
  for (let dx = 0; dx <= 2.5; dx += 0.05) if (ringsAreLinked({ dx, tube })) ok.push(+dx.toFixed(2))
  // lý thuyết: |dx−1| < 1−tube  →  tube < dx < 2−tube  →  0.1 < dx < 1.9
  assert.ok(ok[0] > tube && ok[0] < tube + 0.06, `mép dưới ${ok[0]}`)
  assert.ok(ok[ok.length - 1] < 2 - tube && ok[ok.length - 1] > 2 - tube - 0.06)
  assert.ok(ok.includes(+RING_LINK.dx.toFixed(2)), 'dx đang dùng phải nằm trong khoảng lồng được')
})

test('vì sao KHÔNG được xoay nhẫn B quanh trục Y', () => {
  // Xoay quanh Y: hai điểm xuyên mặt phẳng nhẫn A đều cách tâm √(dx²+1),
  // tức BẰNG NHAU → không thể một trong một ngoài → không bao giờ lồng.
  for (const dx of [0.5, 1, 1.25, 1.8]) {
    const d = Math.hypot(dx, 1)
    const inside = d < 1 - RING_LINK.tube
    const outside = d > 1 + RING_LINK.tube
    assert.ok(!(inside && outside), 'hai điểm xuyên bằng nhau thì không thể vừa trong vừa ngoài')
  }
})

test('đường tim: khép kín, đúng kích thước, tâm ở gốc', () => {
  const pts = heartOutline(400)
  // so sánh có dung sai chứ không deepEqual: t = 2π cho sin ≈ −2.4e−16 nên toạ
  // độ cuối ra −0, mà Object.is(+0, −0) là false
  const [x0, y0] = pts[0]
  const [xn, yn] = pts[pts.length - 1]
  assert.ok(Math.abs(x0 - xn) < 1e-9 && Math.abs(y0 - yn) < 1e-9, 'điểm đầu và cuối phải trùng nhau')

  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const w = Math.max(...xs) - Math.min(...xs)
  const h = Math.max(...ys) - Math.min(...ys)
  assert.ok(Math.abs(w - HEART_W) < 0.5, `rộng ${w}, khai báo ${HEART_W}`)
  assert.ok(Math.abs(h - HEART_H) < 0.5, `cao ${h}, khai báo ${HEART_H}`)
  // tâm mực phải ở gốc, nếu lệch thì hai tim xoay quanh điểm sai → mất đối xứng
  assert.ok(Math.abs((Math.max(...ys) + Math.min(...ys)) / 2) < 0.5)
  assert.ok(Math.abs((Math.max(...xs) + Math.min(...xs)) / 2) < 0.5)
})
