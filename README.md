# Nhạc Sống — Next.js

Website lời bài hát tiếng Việt dùng Next.js App Router và React. Trình duyệt gọi
trực tiếp API LRCLIB.net; không cần API key hoặc cơ sở dữ liệu riêng.

## Chạy trên máy

Yêu cầu Node.js 20.9 trở lên.

```sh
npm ci
npm run dev
```

Mở http://localhost:3000. Chạy bản production bằng `npm run build` rồi `npm start`.

## Cấu trúc

- `app/`: trang chủ, bố cục, metadata và CSS.
- `components/`: tìm kiếm, lưu bài, đọc lời, trình chiếu và tự cuộn bằng React.
- `lib/lyrics.mjs`: xử lý lời và kiểm tra dữ liệu API.
- `tests/`: kiểm tra xử lý lời và các luồng tương tác trong trình duyệt.

Bài đã lưu tiếp tục dùng khóa `loi.saved.v1`, tương thích bản giao diện trước.
Dữ liệu chỉ ở trình duyệt hiện tại, không đồng bộ tài khoản. Đổi tên miền hoặc
trình duyệt sẽ không tự chuyển bài đã lưu.

## Vercel

Repository: https://github.com/doananhdung03/nhacsong

Import repo với Framework Preset **Next.js**, Root Directory là thư mục gốc.
Cấu hình `vercel.json` dùng `npm ci`, `npm run build` và output `.next`.
Nếu dự án Vercel trước đây dùng Other/public, đổi preset sang Next.js và bỏ
các thiết lập ghi đè cũ. Không cần biến môi trường.

## Kiểm tra

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Kiểm tra trình duyệt dùng phản hồi API giả lập để không phụ thuộc dịch vụ ngoài.
Next.js cần script nội tuyến để khởi tạo trang; CSP hiện cho phép inline script
và chỉ mở kết nối API tới LRCLIB (thêm WebSocket cho phát triển tại máy).

## Chức năng và giới hạn

Tự động tìm từ 1 ký tự sau khi ngừng gõ 350 ms; Enter/nút tìm chạy ngay.
Hủy tìm kiếm cũ khi thay đổi nội dung, chờ gõ xong dấu tiếng Việt trước khi tìm.
Giữ nguyên khoảng trắng trong ô nhập; chỉ chuẩn hóa khoảng trắng khi gửi API.
Ưu tiên kết quả có dấu hiệu tiếng Việt trong tên bài, ca sĩ và lời bài hát.
Đây là nhận diện gần đúng vì API không có trường ngôn ngữ; các kết quả khác vẫn được giữ.
Tìm bài, chọn bản thu, lưu/bỏ lưu, chỉnh cỡ chữ, cuộn tay hoặc tự cuộn,
Nhấn vào bài để mở ngay trình chiếu toàn màn hình khi trình duyệt cho phép.
Lời được chia theo đoạn trống, mỗi trang tối đa 4 dòng; dòng dài được ngắt thêm.
Trang đầu hiển thị tên bài và ca sĩ. Chữ tự co để vừa màn hình.
Phím mũi tên/Space chuyển đoạn, Home/End tới đầu/cuối, Esc thoát.
Có nút chọn từng đoạn, nền sáng/tối được ghi nhớ trên trình duyệt.
Nếu không có Fullscreen API, trình chiếu vẫn mở phủ cửa sổ trình duyệt.

Cuộn theo tốc độ do người dùng chọn, chưa đồng bộ với âm thanh. Không có phát
nhạc, hợp âm hoặc tone. API có thể thiếu bài hoặc giới hạn lượt gọi.
Quyền sử dụng lời bài hát cần kiểm tra riêng trước khi kinh doanh.
