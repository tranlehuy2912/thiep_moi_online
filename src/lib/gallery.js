// Trạng thái băng chuyền album, dùng chung.
//
// Nằm riêng ở lib/ chứ KHÔNG ở trong three/CurvedGallery.jsx là có lý do: lớp
// HTML (nút bấm xem ảnh to) cần đọc `index` để biết đang xem tấm nào. Nếu import
// từ CurvedGallery thì kéo luôn cả three.js vào chunk chính — mà cả `Stage` được
// lazy-load chính là để tránh chuyện đó.
//
// Cũng cố ý KHÔNG để trong React state: useFrame đọc/ghi object này mỗi frame.
export const galleryState = {
  offset: 0, // vị trí hiện tại của dãy ảnh
  target: 0, // vị trí ĐÍCH — dãy luôn damp về đây, nhờ vậy ảnh luôn dừng thẳng
  dragging: false,
  index: 0, // tấm đang ở giữa khung
  lastInput: 0,
}
