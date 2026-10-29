# Thư viện IL

Thư viện lưu animation, component và prototype trang để xem trực tiếp, lấy code, dùng cho AI và gửi cho dev.

Trang: https://ilong6.github.io/thu-vien-il/

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `index.html` | Mã nguồn trang (dùng chung cho bản Claude artifact) |
| `docs/index.html` | Bản build cho GitHub Pages, tạo bằng `tools/build.py` |
| `demos/<slug>/` | Code từng demo tách riêng (index.html, style.css, script.js) |

## Cập nhật trang

```bash
python3 tools/build.py
git add -A && git commit -m "..." && git push
```

## Giới hạn của phase 1

- Sửa thông tin, danh mục và trạng thái chia sẻ chỉ lưu trong trình duyệt của người đang dùng.
- Link chia sẻ `/s/...` và nút tải file chưa hoạt động. Cần máy chủ (phase 3).
- Chưa có đăng nhập.
