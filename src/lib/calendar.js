// Link "Thêm vào lịch" — Google Calendar cho web, file .ics cho iPhone/Outlook.

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
    location: `${ev.venue}, ${ev.address}`,
  })
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

export function downloadIcs(ev, coupleNames) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//thiep-cuoi//VN',
    'BEGIN:VEVENT',
    `UID:${ev.id}-${toUtcStamp(ev.date)}@thiep-cuoi`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${toUtcStamp(ev.date)}`,
    `DTEND:${toUtcStamp(endOf(ev.date))}`,
    `SUMMARY:${ev.title} — ${coupleNames}`,
    `DESCRIPTION:${ev.host} · ${ev.timeLabel}`,
    `LOCATION:${ev.venue}\\, ${ev.address}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${ev.id}.ics`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function mapsUrl(ev) {
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
