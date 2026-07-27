// Environment map dựng tại chỗ bằng canvas 2D + PMREMGenerator.
//
// Vì sao không dùng <Environment preset> của drei: preset tải file HDR ~1–2MB
// từ CDN — thêm một request có thể hỏng, cho một thứ mà ở đây chỉ cần vài vệt
// sáng để nhẫn vàng có cái phản chiếu. Cách này 0 byte, 0 request.
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../config.js'

export default function GoldEnvironment() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    const W = 512
    const H = 256
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')

    // Nửa trên = "trời" ấm sáng, nửa dưới = "đất" tối → nhẫn có ranh giới
    // sáng/tối rõ ràng, đó chính là thứ làm kim loại trông ra kim loại.
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#FFF6E0')
    g.addColorStop(0.38, PALETTE.sun)
    g.addColorStop(0.52, '#3C5F6E')
    g.addColorStop(1, PALETTE.skyDeep)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    // Vài nguồn sáng rời → khi nhẫn xoay sẽ có vệt loé chạy dọc vành
    ctx.globalCompositeOperation = 'lighter'
    const lamps = [
      [W * 0.2, H * 0.22, W * 0.16, 'rgba(255,255,255,0.95)'],
      [W * 0.62, H * 0.16, W * 0.11, 'rgba(255,236,196,0.9)'],
      [W * 0.85, H * 0.34, W * 0.09, 'rgba(231,190,114,0.8)'],
      [W * 0.42, H * 0.68, W * 0.14, 'rgba(120,160,180,0.35)'],
    ]
    for (const [x, y, r, color] of lamps) {
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r)
      rg.addColorStop(0, color)
      rg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = rg
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'

    const tex = new THREE.CanvasTexture(c)
    tex.mapping = THREE.EquirectangularReflectionMapping
    tex.colorSpace = THREE.SRGBColorSpace

    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromEquirectangular(tex).texture
    scene.environment = env

    tex.dispose()
    pmrem.dispose()

    return () => {
      if (scene.environment === env) scene.environment = null
      env.dispose()
    }
  }, [gl, scene])

  return null
}
