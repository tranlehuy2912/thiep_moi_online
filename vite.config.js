import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Chạy qua tunnel (ngrok / cloudflared) để xem trên điện thoại thật:
//   npm run dev:tunnel
// Biến này bật thêm cấu hình HMR cho tunnel, xem chú thích ở dưới.
const TUNNEL = !!process.env.VITE_TUNNEL

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5180,
    host: true,

    // Vite chặn mọi Host lạ để tránh DNS rebinding. Tên miền ngrok đổi mỗi lần
    // khởi động lại nên không hardcode được — dấu chấm đầu = cho phép cả
    // subdomain của miền đó.
    allowedHosts: [
      '.ngrok-free.dev',
      '.ngrok-free.app',
      '.ngrok.io',
      '.ngrok.app',
      '.trycloudflare.com',
      '.loca.lt',
    ],

    // Qua tunnel https, trang chạy ở cổng 443 nhưng Vite lại mặc định mở
    // websocket HMR về cổng 5180 → không kết nối được, console đầy lỗi.
    // Chỉ bật khi thật sự đi qua tunnel, để dev ở localhost không bị ảnh hưởng.
    ...(TUNNEL ? { hmr: { clientPort: 443, protocol: 'wss' } } : {}),
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber'],
        },
      },
    },
  },
})
