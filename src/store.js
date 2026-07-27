import { create } from 'zustand'
import { getTier } from './lib/quality.js'

export const useStore = create((set) => ({
  // màn đang cuộn tới (chỉ đổi khi thật sự sang màn khác → React re-render rất thưa)
  section: 0,
  setSection: (section) => set((s) => (s.section === section ? s : { section })),

  tier: getTier(),
  setTier: (tier) => set({ tier }),

  musicOn: false,
  setMusicOn: (musicOn) => set({ musicOn }),
}))

// Móc gỡ lỗi khi chạy dev: cho phép nhảy thẳng tới một màn từ console
// (`__store.getState().setSection(3)`). Bản build production không có dòng này.
if (import.meta.env.DEV) window.__store = useStore
