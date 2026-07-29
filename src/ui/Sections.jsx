// Toàn bộ nội dung HTML của thiệp. Canvas 3D nằm dưới, phần này nổi lên trên.
import { useEffect, useRef, useState } from 'react'
import { COUPLE, EVENTS, GALLERY, GIFT, RSVP } from '../config.js'
import { googleCalendarUrl, mapsUrl, countdown } from '../lib/calendar.js'
import { registerSection } from '../lib/scroll.js'
import {
  BOTH,
  buildPayload,
  isFirebaseReady,
  firestoreUrl,
  toFirestoreFields,
  wishPayload,
  wishesWriteUrl,
  wishesListUrl,
  parseWishes,
} from '../lib/rsvp.js'
import { celebrate } from '../lib/burst.js'

const NAMES = `${COUPLE.groom.name} & ${COUPLE.bride.name}`

function Panel({ id, className = '', children }) {
  const ref = useRef(null)
  useEffect(() => registerSection(id, ref.current), [id])
  return (
    <section id={id} ref={ref} className={`panel ${className}`}>
      <div className="wrap">{children}</div>
    </section>
  )
}

/* ------------------------------------------------------------------ Hero */

export function Hero() {
  return (
    <Panel id="hero" className="hero">
      {/* chừa chỗ cho cụm hạt 3D ở nửa trên */}
      <div className="hero-space" aria-hidden="true" />

      <h1 className="display names reveal" style={{ '--d': '.1s' }}>
        <span className="gold-text">{COUPLE.groom.name.toUpperCase()}</span>
        <span className="amp">&amp;</span>
        <span className="gold-text">{COUPLE.bride.name.toUpperCase()}</span>
      </h1>

      {/* <p className="tagline reveal" style={{ '--d': '.25s' }}>
        Cùng một nghề chung, gõ chữ lâu<br />
        Quen nhau từ những buổi canh thâu<br />
        Mùng bốn tháng chín, duyên mình khởi<br />
        Mấy bận chua cay, nghẹn nỗi sầu<br /><br />
        Vá lỗi chương trình không mấy khó<br />
        Giữ tình hai đứa có dễ đâu<br />
        Vẫn trong tháng chín, thêm lần nữa<br />
        Đến buổi hai mươi, xin rước dâu
      </p> */}

      <div className="dates reveal" style={{ '--d': '.4s' }}>
        {EVENTS.map((e) => (
          <div key={e.id}>
            <div className="k">{e.side}</div>
            <div className="v">
              {String(e.date.getDate()).padStart(2, '0')} · {String(e.date.getMonth() + 1).padStart(2, '0')} ·{' '}
              {e.date.getFullYear()}
            </div>
            {/* Giờ để riêng một dòng, KHÔNG ghép vào dòng ngày: dòng ngày đang
                nowrap và cỡ chữ lớn, thêm giờ vào là tràn mép trên điện thoại. */}
            {e.timeLabel && <div className="t">{e.timeLabel}</div>}
            {/* Địa điểm ngắn. Địa chỉ đầy đủ nằm ở màn "Hồi sau" — ở đây mà để
                cả địa chỉ thì màn mở đầu rối và tràn trên điện thoại. */}
            {(e.place || e.mapQuery) && <div className="p">{e.place || e.mapQuery}</div>}
          </div>
        ))}
      </div>
    </Panel>
  )
}

/* -------------------------------------------------------- Save the date */

function Countdown({ ev }) {
  const [t, setT] = useState(() => countdown(ev.date))
  useEffect(() => {
    const id = setInterval(() => setT(countdown(ev.date)), 1000)
    return () => clearInterval(id)
  }, [ev])

  const cells = t
    ? [
        [t.days, 'ngày'],
        [t.hours, 'giờ'],
        [t.minutes, 'phút'],
        [t.seconds, 'giây'],
      ]
    : null

  return (
    <div className="card reveal">
      <p className="eyebrow" style={{ margin: 0 }}>
        {ev.side}
      </p>
      <h3 className="cd-title">{ev.title}</h3>
      <p className="cd-sub">{ev.dateLabel}</p>

      {cells ? (
        <div className="cd-grid">
          {cells.map(([n, lab]) => (
            <div className="cd-cell" key={lab}>
              <div className="cd-num">{String(n).padStart(2, '0')}</div>
              <div className="cd-lab">{lab}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="script" style={{ fontSize: 22 }}>
          Hẹn tương phùng!
        </p>
      )}

      <div className="ev-actions">
        <a className="btn" href={googleCalendarUrl(ev, NAMES)} target="_blank" rel="noreferrer">
          Google Calendar
        </a>
      </div>
    </div>
  )
}

export function SaveTheDate() {
  return (
    <Panel id="save">
      <h2 className="display reveal" style={{ fontSize: 'clamp(28px,5.5vw,52px)' }}>
        Hồi Đầu
      </h2>
      <hr className="rule" />
      <p className="lead reveal">
        Thời gian tích tắc vòng quay<br />
        Lòng nghe rạo rực ngóng ngày thành đôi<br />
        Bạn ơi đếm ngược giờ trôi<br />
        Hai bên sắm sửa, bồi hồi đợi mong
      </p>

      <div className="countdowns">
        {EVENTS.map((e) => (
          <Countdown key={e.id} ev={e} />
        ))}
      </div>
    </Panel>
  )
}

/* ---------------------------------------------------------------- Album */

// Màn này KHÔNG có chữ nào: chỉ là vùng bắt thao tác kéo, còn ảnh do canvas 3D
// vẽ đè lên. Bản thân ảnh cưới đã nói rõ đây là album.
export function Gallery() {
  return (
    <Panel id="gallery">
      <div
        className="gallery-stage"
        data-gallery-drag
        data-interactive
        aria-label={`Album ${GALLERY.length} ảnh cưới, kéo ngang để xem`}
      />
    </Panel>
  )
}

/* --------------------------------------------------------------- Hôn lễ */

function EventCard({ ev }) {
  return (
    <div className="card reveal">
      <div className="ev-side">{ev.side}</div>
      <h3 className="ev-title gold-text">{ev.title}</h3>
      <p className="ev-host">{ev.host}</p>

      <dl className="ev-rows">
        <div className="ev-row">
          <dt>Ngày</dt>
          <dd>
            {ev.dateLabel}
            <br />
            <span className="muted">{ev.lunar}</span>
          </dd>
        </div>
        <div className="ev-row">
          <dt>Giờ</dt>
          <dd>{ev.timeLabel}</dd>
        </div>
        <div className="ev-row">
          <dt>Địa điểm</dt>
          <dd>
            {ev.venue}
            <br />
            <span className="muted">{ev.address}</span>
          </dd>
        </div>
      </dl>

      <div className="ev-actions">
        <a className="btn" href={mapsUrl(ev)} target="_blank" rel="noreferrer">
          Chỉ đường
        </a>
        <a className="btn ghost" href={googleCalendarUrl(ev, NAMES)} target="_blank" rel="noreferrer">
          Lưu lịch
        </a>
      </div>
    </div>
  )
}

export function Details() {
  return (
    <Panel id="details">
      <h2 className="display reveal" style={{ fontSize: 'clamp(28px,5.5vw,52px)' }}>
        Hồi Sau
      </h2>
      <hr className="rule" />
      <p className="lead reveal">
        {/* Hai ngày, hai phía, ở hai nơi.<br />
        Thiệp hồng trao tay, gửi nụ cười.<br />
        Bạn ghé bên nào mình cũng đợi,<br />
        Chung ly rượu chúc, vạn ngày vui. */}
        Từ nay duyên thắm mãi không thôi<br />
        Tiệc cưới hai nơi đã sẵn rồi<br />
        Tháng Chín hai mươi nhà gái đợi<br />
        Tháng Mười mùng bốn bước chung đôi
      </p>

      <div className="events">
        {EVENTS.map((e) => (
          <EventCard key={e.id} ev={e} />
        ))}
      </div>

      {GIFT.enabled && (
        <div className="card reveal" style={{ marginTop: 26 }}>
          <div className="ev-side">Hộp mừng cưới</div>
          <p className="lead" style={{ marginTop: 10 }}>
            Sự có mặt của bạn đã là món quà lớn nhất. Nếu bạn ở xa không tới được, đây là chút
            thông tin để gửi lời chúc.
          </p>
          <div className="gift-grid">
            {GIFT.accounts.map((a) => (
              <div key={a.number}>
                <div className="ev-side">{a.label}</div>
                <img
                  className="gift-qr"
                  alt={`QR chuyển khoản ${a.label}`}
                  loading="lazy"
                  src={`https://img.vietqr.io/image/${a.bank}-${a.number}-compact.png?accountName=${encodeURIComponent(a.holder)}`}
                />
                <div className="gift-acc">{a.number}</div>
                <div className="muted">
                  {a.bankName} · {a.holder}
                </div>
                <button
                  className="btn ghost"
                  style={{ marginTop: 12, padding: '9px 16px', fontSize: 11 }}
                  data-interactive
                  onClick={() => navigator.clipboard?.writeText(a.number)}
                >
                  Sao chép số TK
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  )
}

/* ----------------------------------------------------------------- RSVP */

// dd/MM/yyyy — dùng cho nhãn chọn tiệc, ngày lấy thẳng từ EVENTS trong config
const dmy = (d) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`

// Nút chọn kiểu radio. aria-pressed để trình đọc màn hình biết cái nào đang chọn —
// chỉ đổi màu viền thì người dùng trình đọc màn hình không nhận ra được gì.
function Choice({ on, onClick, children }) {
  return (
    <button
      type="button"
      className={`choice ${on ? 'on' : ''}`}
      aria-pressed={on}
      onClick={onClick}
      data-interactive
    >
      {children}
    </button>
  )
}

// Bảng lời chúc công khai. Đọc từ collection `wishes` — collection này CHỈ có
// tên + lời chúc, không mang thông tin tham dự, nên cho đọc công khai là an toàn.
function WishWall({ reloadKey }) {
  const [wishes, setWishes] = useState([])

  useEffect(() => {
    if (!isFirebaseReady(RSVP.firebase)) return
    let alive = true
    fetch(wishesListUrl(RSVP.firebase))
      .then((r) => {
        if (!r.ok) throw new Error(`wishes ${r.status}`)
        return r.json()
      })
      .then((json) => {
        if (alive) setWishes(parseWishes(json))
      })
      .catch((err) => console.error('[RSVP] không đọc được bảng lời chúc:', err))
    return () => {
      alive = false
    }
  }, [reloadKey])

  // Chưa ai chúc thì ẩn hẳn khối này, không để lại khung rỗng trơ trọi
  if (!wishes.length) return null

  return (
    <>
      <div className="ornament">✦</div>
      <p className="eyebrow reveal" style={{ textAlign: 'center' }}>
        {wishes.length} lời chúc từ thân hữu
      </p>
      <div className="wishes">
        {wishes.map((w) => (
          <div className="wish reveal" key={w.id}>
            <b>{w.name}</b>
            {w.wish}
          </div>
        ))}
      </div>
    </>
  )
}

export function Rsvp() {
  const [form, setForm] = useState({
    name: '',
    attend: 'yes',
    which: EVENTS[0].id, // mặc định tiệc nhà gái (mục đầu trong EVENTS)
    party: 'one', // one | two | other
    countOther: '3',
    wish: '',
  })
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  // true = gửi KHÔNG thành công. Chỉ hiện lời cảm ơn khi thật sự đã ghi được.
  const [failed, setFailed] = useState(false)
  // đổi giá trị này để WishWall tải lại, cho khách thấy ngay lời chúc mình vừa gửi
  const [justWished, setJustWished] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const pick = (k, v) => () => setForm((f) => ({ ...f, [k]: v }))

  const going = form.attend === 'yes'

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || busy) return
    setBusy(true)
    setFailed(false)

    // Dựng dữ liệu gửi đi bằng hàm thuần trong lib/rsvp.js — chỗ đó có test
    // (node --test src/lib/rsvp.test.mjs), vì đây là phần dễ sai nhất của form.
    const payload = buildPayload(form, EVENTS, new Date().toISOString())

    // Chỉ bắn pháo khi hồi âm THẬT SỰ đã vào sổ. Bắn ngay lúc bấm nút thì gặp
    // lúc mạng hỏng sẽ thành ra pháo hoa tưng bừng ngay trên dòng báo lỗi.
    let ok = false

    if (isFirebaseReady(RSVP.firebase)) {
      try {
        const res = await fetch(firestoreUrl(RSVP.firebase), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toFirestoreFields(payload)),
        })
        // Firestore có CORS nên đọc được kết quả thật — sai rules hay sai
        // projectId là biết ngay, không âm thầm mất phản hồi của khách.
        if (!res.ok) throw new Error(`Firestore ${res.status}`)
        ok = true

        // Lời chúc ghi thêm sang collection `wishes` để hiện lên bảng công khai.
        // Cố ý KHÔNG để lỗi ở đây làm hỏng cả lượt gửi: hồi âm đã vào `rsvp`
        // an toàn rồi, bảng lời chúc chỉ là phần trang trí.
        const wish = wishPayload(payload)
        if (wish) {
          fetch(wishesWriteUrl(RSVP.firebase), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toFirestoreFields(wish)),
          })
            .then((r) => {
              if (!r.ok) throw new Error(`wishes ${r.status}`)
              setJustWished(true) // để bảng lời chúc tải lại
            })
            .catch((err) => console.error('[RSVP] không ghi được lời chúc:', err))
        }
      } catch (err) {
        console.error('[RSVP] gửi lên Firestore thất bại:', err)
        setFailed(true)
      }
    } else if (RSVP.endpoint) {
      try {
        // text/plain là loại duy nhất gửi được ở chế độ no-cors mà không bị preflight,
        // và cũng đúng thứ Google Apps Script mong đợi (e.postData.contents).
        await fetch(RSVP.endpoint, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        })
        ok = true
      } catch (err) {
        console.error('[RSVP] gửi lên endpoint thất bại:', err)
        setFailed(true)
      }
    } else {
      // Chưa cấu hình chỗ nhận → coi như thất bại, KHÔNG hiện lời cảm ơn.
      console.error(
        '[RSVP] chưa cấu hình chỗ nhận phản hồi. Điền RSVP.firebase trong src/config.js — xem README.',
      )
      setFailed(true)
    }

    setSent(true)
    setBusy(false)
    if (ok) celebrate()
  }

  return (
    <Panel id="rsvp">
      <h2 className="display reveal" style={{ fontSize: 'clamp(28px,5.5vw,52px)' }}>
        Hồi Âm
      </h2>
      <hr className="rule" />
      <p className="lead reveal">
        {/* Để tình đón tiếp chu toàn.<br />
        Mâm bàn tươm tất đón đoàn bạn thân.<br />
        Xin đừng ngại ngần phân vân,<br />
        Trước ngày mười chín nhắn trân trọng lời. */}
        Hai ngày, hai tiệc, hai nơi<br />
        Tiện đường anh chị ghé chơi hôm nào<br />
        Chỉ cần một chữ gửi trao<br />
        Là bên này biết dọn bao nhiêu bàn
      </p>

      {sent ? (
        <div className="card reveal" style={{ marginTop: 26, textAlign: 'center' }}>
          {failed ? (
            /* Phải có nút thử lại. `failed` nghĩa là hồi âm CHƯA tới tay — chỉ
               hiện một dòng báo lỗi rồi để đó là khách hết đường phản hồi.
               Bấm thử lại thì quay về form, dữ liệu đã điền vẫn còn nguyên. */
            <>
              <h3 className="script" style={{ fontSize: 28, margin: 0 }}>
                Tín hiệu trục trặc bất thành
              </h3>
              <p className="lead" style={{ margin: '10px auto 18px' }}>
                Hồi âm chưa tới tay chúng mình. Xin thân hữu thử lại giúp một lần nữa.
              </p>
              <button className="btn solid" onClick={() => setSent(false)} data-interactive>
                Thử lại
              </button>
            </>
          ) : (
            <>
              <h3 className="script" style={{ fontSize: 30, margin: 0 }}>
                Đa tạ thân hữu!
              </h3>
              <p className="lead" style={{ margin: '10px auto 0' }}>
                Kính hẹn tương hội trong ngày đại hỷ!
              </p>
            </>
          )}
        </div>
      ) : (
        <form className="form card" onSubmit={submit} style={{ marginTop: 26 }}>
          {/* 1 */}
          <div className="field">
            <label htmlFor="rsvp-name">Tôn tính đại danh</label>
            <input
              id="rsvp-name"
              value={form.name}
              onChange={set('name')}
              placeholder="Phan Tới Bến"
              required
              data-interactive
            />
          </div>

          {/* 2 */}
          <div className="field">
            <label>
              Quý khách có quang lâm yến tiệc chăng?
            </label>
            <div className="choices">
              <Choice on={going} onClick={pick('attend', 'yes')}>
                Định ngày đến dự!
              </Choice>
              <Choice on={!going} onClick={pick('attend', 'no')}>
                Lỡ hẹn kỳ duyên!
              </Choice>
            </div>
          </div>

          {/* 3 + 4 — chỉ hỏi khi khách chọn sẽ đến. Người đã bảo không đến được
              mà vẫn bị hỏi "đi một mình hay đi cùng ai" thì rất vô lý. */}
          {going && (
            <>
              <div className="field">
                <label>Yến tiệc song đường, quang lâm phương xứ?</label>
                <div className="choices">
                  {EVENTS.map((ev) => (
                    <Choice key={ev.id} on={form.which === ev.id} onClick={pick('which', ev.id)}>
                      Yến tiệc {ev.side} ({dmy(ev.date)})
                    </Choice>
                  ))}
                  {/* đếm theo EVENTS chứ không viết cứng "2", để sau này thêm
                      tiệc thứ ba thì nhãn vẫn đúng */}
                  <Choice on={form.which === BOTH} onClick={pick('which', BOTH)}>
                    Song yến tề phi
                  </Choice>
                </div>
              </div>

              <div className="field">
                <label>Tùy tùng thân hữu đồng hành?</label>
                <div className="choices">
                  <Choice on={form.party === 'one'} onClick={pick('party', 'one')}>
                    Độc hành quang lâm
                  </Choice>
                  <Choice on={form.party === 'two'} onClick={pick('party', 'two')}>
                    Song hành tương hội
                  </Choice>
                  <Choice on={form.party === 'other'} onClick={pick('party', 'other')}>
                    Gia quyến đồng hành
                  </Choice>
                </div>

                {form.party === 'other' && (
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={form.countOther}
                    onChange={set('countOther')}
                    aria-label="Số người sẽ đến"
                    placeholder="Mấy người tất cả?"
                    style={{ marginTop: 10 }}
                    data-interactive
                  />
                )}
              </div>
            </>
          )}

          {/* 5 */}
          <div className="field">
            <label htmlFor="rsvp-wish">
              Kính xin lưu lại vạn chữ chúc từ
            </label>
            <textarea
              id="rsvp-wish"
              value={form.wish}
              onChange={set('wish')}
              placeholder="Nhắn gửi lời chúc phúc bách niên giai lão tại đây..."
              data-interactive
            />
          </div>

          <button className="btn solid" type="submit" disabled={busy} data-interactive>
            {busy ? 'Chuyển phát...' : 'Tất định tương hội'}
          </button>
        </form>
      )}

      <WishWall reloadKey={justWished} />
    </Panel>
  )
}

/* ---------------------------------------------------------------- Outro */

export function Outro() {
  return (
    <Panel id="outro" className="outro">
      {/* chừa chỗ cho đôi nhẫn 3D ở nửa trên */}
      <div className="hero-space" aria-hidden="true" />

      <h2 className="thanks reveal">Hồi Kết</h2>
      <p className="lead reveal" style={{ margin: '14px auto 0' }}>
        Cảm ơn mấy bạn, bớt thời gian<br />
        Đọc hết trăm ngàn, ý chứa chan<br />
        Tiệc cưới đôi nơi, bày cỗ đợi<br />
        Ngày vui có bạn, trọn bình an
      </p>

      <div className="ornament">✦</div>

      <h3 className="display gold-text reveal" style={{ fontSize: 'clamp(26px,6vw,58px)' }}>
        {COUPLE.groom.name.toUpperCase()} & <br />{COUPLE.bride.name.toUpperCase()}
      </h3>
    </Panel>
  )
}
