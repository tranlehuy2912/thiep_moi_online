Nhạc nền của thiệp: nhac.mp3 — "Vá Lỗi Chương Trình".

Đang có gì
  - nhac.mp3 — 194kbps, 48kHz stereo, 3:37, 5.0MB.
    (Nguồn: "Vá Lỗi Chương Trình (3).mp3" — bản dựng ngày 29/07/2026)
  - Audio Y HỆT BẢN GỐC từng bit (remux -c:a copy, không encode lại).
    Kiểm chứng: lấy hiệu hai tín hiệu ra -91 dB, tức sàn nhiễu số học.
  - Chỉ bỏ ảnh bìa mjpeg nhúng trong ID3 (-vn), đỡ 17KB mà trang không dùng tới.
  - Không chỉnh loudness: bản gốc đã ở -13.6 LUFS (chuẩn nhạc thương mại),
    hạ âm lượng là việc của MUSIC.volume.

⚠️ ĐỪNG nén lại cho "nhẹ"
  Đã thử 128kbps: file còn 3.3MB nhưng mất thật -2.0 dB ở dải trên 16kHz,
  -4.3 dB ở dải trên 18kHz, và hiệu tín hiệu so với gốc lên tới đỉnh -11.8 dB.
  Mà đổi lại chẳng được gì: preload='metadata' nên file CHỈ tải khi có người
  bấm phát, và 197kbps chỉ cần 25KB/s để phát liền — 3G cũng thừa sức.

Thay bài khác
  - Ghi đè file này, hoặc đổi MUSIC.src trong src/config.js.
  - Âm lượng: MUSIC.volume trong src/config.js (đang 0.45).
  - Giữ nguyên chất lượng, chỉ gỡ ảnh bìa và gắn thẻ:
      ffmpeg -i bai-hat.mp3 -vn -c:a copy \
             -metadata title='...' -metadata artist='...' \
             public/audio/nhac.mp3

Cách nó chạy
  - Nhạc phát sau thao tác ĐẦU TIÊN của khách (chạm / gõ phím / bấm bất cứ đâu).
    Trình duyệt chặn tự phát khi chưa có thao tác thật, nên không thể sớm hơn.
  - Vào/ra đều fade dần, không cắt phũ.
  - preload = 'metadata' lúc đầu, chỉ nạp cả bài sau khi trang đã tải xong —
    tránh giành băng thông với ảnh và khung hình đầu tiên.
  - Thiếu file (404) thì nút nhạc TỰ ẨN, trang vẫn chạy bình thường.
