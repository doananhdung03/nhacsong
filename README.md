# Lời — Website lời bài hát

Giao diện tiếng Việt gọi trực tiếp `https://lrclib.net/api/search` từ trình duyệt.
Không cần API key, Docker, Rust, máy chủ riêng hoặc cài thư viện.

## Chức năng

- Tìm bài theo tên hoặc ca sĩ, phân biệt nhiều bản thu.
- Đọc lời, điều chỉnh cỡ chữ, tự cuộn theo tốc độ tùy chọn.
- Trình chiếu nền tối, toàn màn hình trên trình duyệt hỗ trợ; cuộn tay hoặc tự cuộn.
- Lưu bài trên trình duyệt và mở lại từ mục Bài đã lưu.
- Hiển thị lỗi mạng, giới hạn lượt gọi và kết quả rỗng.

Đây là cuộn theo tốc độ do người dùng chọn, chưa tự đồng bộ lời với âm thanh.
Không có phát nhạc, hợp âm hoặc dữ liệu tone. Không tự tải bài khi mở trang.

## Đưa lên Vercel

1. Repository giao diện: https://github.com/doananhdung03/nhacsong.
2. Vercel → Add New → Project → chọn `doananhdung03/nhacsong`.
3. Framework Preset: **Other**. Root Directory là thư mục chứa `vercel.json`.
4. Output Directory: **public**. Không cần Build Command, Install Command hoặc biến môi trường.
5. Deploy. File `vercel.json` đã chứa cấu hình tương ứng và các header bảo vệ.

Không chọn repo Rust `lrclib` làm thư mục triển khai giao diện.
Nếu dùng Vercel CLI đã đăng nhập, chạy `vercel --prod` trong thư mục này.

## Kiểm tra

```sh
npm test
node --check public/app.js
```

Để xem thử, phục vụ thư mục `public` bằng một HTTP server tĩnh; không mở bằng
`file://` vì trang dùng JavaScript modules. Mã nguồn không cần bước build.

## Lưu ý vận hành

Bài đã lưu chỉ ở localStorage của thiết bị/trình duyệt hiện tại, không đồng bộ tài khoản.
API có thể giới hạn truy cập và không đảm bảo có mọi bài tiếng Việt. Thử lại sau khi gặp 429.
Dữ liệu API được hiển thị như văn bản, không chèn HTML từ bên ngoài.
Quyền sử dụng lời bài hát phải được kiểm tra riêng trước khi kinh doanh.

Chưa triển khai lên tài khoản Vercel; nhập repository trên vào tài khoản Vercel của bạn.
