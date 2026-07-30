// Tối ưu ảnh cưới: resize + xuất WebP (và AVIF nếu muốn) vào public/photos/.
//
//   node scripts/optimize-photos.mjs <thư-mục-ảnh-gốc> [--avif] [--max=1600] [--q=82]
//
// Ảnh gốc từ studio thường 8–12MB/tấm. Album tải hết một lúc nên phải ép nhỏ,
// nếu không khách mở bằng 4G sẽ bỏ đi trước khi ảnh kịp hiện.
//
// MỘT bộ ảnh duy nhất dùng cho cả ba việc: băng chuyền album, nền màn mở đầu,
// và xem to khi bấm vào ảnh.
//
// Vì sao 1600px: khâu khó nhất là xem to. Điện thoại 375×812 ở DPR 3 là 1125
// pixel ngang thật; ảnh dọc 2:3 phủ kín khung đó cần 1687px cạnh dài. 1600px
// đạt 95% — mắt không phân biệt được. Trước đây để 1200px thì mở to là KÉO GIÃN
// ảnh lên, mờ hơn cả lúc thu nhỏ.
//
// Đừng đẩy lên 2000px: mỗi ảnh giải nén ra chiếm ~10MB bộ nhớ GPU, 40 ảnh là
// ~430MB — điện thoại không gánh nổi. Ở 1600px còn ~273MB, và tải về 1.7MB.
import { readdir, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const args = process.argv.slice(2)
const srcDir = args.find((a) => !a.startsWith('--'))
const wantAvif = args.includes('--avif')
const MAX = Number(args.find((a) => a.startsWith('--max='))?.split('=')[1] ?? 1600)
const Q = Number(args.find((a) => a.startsWith('--q='))?.split('=')[1] ?? 82)

if (!srcDir) {
  console.error('Thiếu thư mục ảnh gốc.\n  node scripts/optimize-photos.mjs <thư-mục> [--avif]')
  process.exit(1)
}

const outDir = path.resolve('public/photos')
await mkdir(outDir, { recursive: true })

const files = (await readdir(srcDir))
  .filter((f) => /\.(jpe?g|png|tiff?|heic|webp)$/i.test(f))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))

if (!files.length) {
  console.error(`Không tìm thấy ảnh nào trong ${srcDir}`)
  process.exit(1)
}

console.log(`${files.length} ảnh · cạnh dài tối đa ${MAX}px · chất lượng ${Q}\n`)

let totalIn = 0
let totalOut = 0

for (let i = 0; i < files.length; i++) {
  const src = path.join(srcDir, files[i])
  const base = `album-${i + 1}`
  const img = sharp(src).rotate().resize({
    width: MAX,
    height: MAX,
    fit: 'inside',
    withoutEnlargement: true,
  })

  const outs = [
    img.clone().webp({ quality: Q, effort: 5 }).toFile(path.join(outDir, `${base}.webp`)),
  ]
  if (wantAvif) {
    outs.push(img.clone().avif({ quality: Q - 8, effort: 4 }).toFile(path.join(outDir, `${base}.avif`)))
  }
  const [webpInfo] = await Promise.all(outs)

  const inSize = (await stat(src)).size
  totalIn += inSize
  totalOut += webpInfo.size
  console.log(
    `${base}.webp  ${webpInfo.width}×${webpInfo.height}  ` +
      `${(inSize / 1048576).toFixed(1)}MB → ${(webpInfo.size / 1024).toFixed(0)}KB   (${files[i]})`,
  )
}

// Ảnh hiện khi share Zalo/Messenger — lấy tấm đầu, crop 1200×630
await sharp(path.join(srcDir, files[0]))
  .rotate()
  .resize(1200, 630, { fit: 'cover', position: 'attention' })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(path.join(outDir, 'og.jpg'))

console.log(
  `\nXong. ${(totalIn / 1048576).toFixed(0)}MB → ${(totalOut / 1048576).toFixed(1)}MB ` +
    `(${files.length} ảnh) + og.jpg`,
)
console.log('Nhớ đặt GALLERY_COUNT trong src/config.js =', files.length)
