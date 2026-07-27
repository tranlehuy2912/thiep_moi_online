// Link "Thêm vào lịch" (Google Calendar), link chỉ đường, và đếm ngược.

function pad(n) {
  return String(n).padStart(2, '0')
}

// Google Calendar nhận UTC dạng 20260920T040000Z
function toUtcStamp(d) {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    '00Z'
  )
}

function endOf(d, hours = 3) {
  return new Date(d.getTime() + hours * 3600 * 1000)
}

export function googleCalendarUrl(ev, coupleNames) {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${ev.title} — ${coupleNames}`,
    dates: `${toUtcStamp(ev.date)}/${toUtcStamp(endOf(ev.date))}`,
    details: `${ev.host}\n${ev.dateLabel} · ${ev.timeLabel}`,
    location: locationText(ev),
  })
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}


// Chuỗi địa điểm cho lịch: có toạ độ thì kèm vào để ứng dụng lịch bấm ra được
// đúng điểm ghim, không phải đoán theo tên.
export function locationText(ev) {
  return [ev.venue, ev.address, ev.coords].filter(Boolean).join(', ')
}

// Nút "Chỉ đường" → mở dẫn đường từ vị trí hiện tại của khách.
//
// Có `coords` thì luôn ưu tiên: nó trỏ đúng điểm ghim. Tìm theo tên kiểu
// "Tư gia nhà gái Quảng Trị" thì Google chẳng biết đó là đâu.
//
// Cố ý KHÔNG lưu link rút gọn maps.app.goo.gl vào config: link đó có thể đổi
// hoặc hết hiệu lực, còn toạ độ thì vĩnh viễn đúng. Lấy toạ độ từ link chia sẻ
// một lần rồi lưu lại là xong.
export function mapsUrl(ev) {
  if (ev.coords) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ev.coords)}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${ev.venue} ${ev.address} ${ev.mapQuery || ''}`.trim(),
  )}`
}

// Đếm ngược tới một mốc; trả về null nếu đã qua.
export function countdown(target, now = Date.now()) {
  let ms = target.getTime() - now
  if (ms <= 0) return null
  const days = Math.floor(ms / 86400000)
  ms -= days * 86400000
  const hours = Math.floor(ms / 3600000)
  ms -= hours * 3600000
  const minutes = Math.floor(ms / 60000)
  ms -= minutes * 60000
  const seconds = Math.floor(ms / 1000)
  return { days, hours, minutes, seconds }
}
