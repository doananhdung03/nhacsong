# Danh sách bài Việt trên Supabase — thiết kế ngắn

## Mục đích
Gõ "AL" phải ra ngay À Lôi, An Lạc, Áo Lụa… (khớp chữ cái đầu hoặc không dấu), giống loinhacsong.pro. LRCLIB không tìm theo chữ cái đầu, nên cần danh sách bài riêng. Lời vẫn lấy từ LRCLIB.

## Phạm vi
- Chỉ một người dùng (chủ dự án). Không có đăng nhập.
- Không lưu lời bài hát vào database — chỉ tên bài, ca sĩ.
- Không có trang quản trị; sửa/xóa bài làm trên Supabase dashboard.

## Cách làm đã chọn (C): Supabase, tự gom bài khi mở
Đã cân nhắc: (A) file JSON trong repo — phải deploy lại mỗi lần thêm bài; (B) chỉ admin thêm — cần đăng nhập. Chọn C vì chỉ một người dùng, nên rủi ro người lạ ghi dữ liệu được chấp nhận.

## Thiết kế
- **Bảng `songs`**: `id`, `title`, `artist`, `initials` (chữ cái đầu không dấu, vd `al`), `folded` (tên không dấu, chữ thường), `key` unique (`folded tên|folded ca sĩ`), `created_at`.
- **Quyền (RLS)**: ai cũng đọc; ai cũng thêm (giới hạn độ dài trường); không ai sửa/xóa qua API.
- **Kết nối**: gọi REST của Supabase bằng `fetch`, không thêm thư viện. Biến môi trường `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Thêm domain Supabase vào CSP `connect-src`.
- **Tìm**: tải toàn bộ danh sách một lần khi mở trang, lọc trên máy. Thứ tự: chữ cái đầu khớp đúng → chữ cái đầu bắt đầu bằng → tên không dấu bắt đầu bằng → tên chứa. Kết quả từ danh sách hiện trước, kết quả LRCLIB (như hiện nay) hiện bên dưới.
- **Bấm bài trong danh sách**: tìm LRCLIB theo tên + ca sĩ, chọn bản khớp nhất để hiện lời.
- **Tự gom**: khi mở một bài từ LRCLIB có dấu hiệu tiếng Việt (điểm hiện có trong `rankTracks` > 0), thêm vào bảng; trùng thì bỏ qua.
- **Dữ liệu ban đầu**: file SQL seed khoảng 100 bài Việt phổ biến (tên + ca sĩ) do Claude soạn — có thể có sai sót nhỏ, sửa trên dashboard.
- **Không có Supabase** (thiếu biến môi trường): trang chạy như hiện nay, chỉ dùng LRCLIB.

## Việc của người dùng
Tạo project Supabase, chạy file SQL (bảng + quyền + seed) trong SQL Editor, đặt 2 biến môi trường ở `.env.local` và trên Vercel.

## Rủi ro đã chấp nhận
Khóa anon nằm công khai trong trang, nên ai biết URL đều có thể thêm bài rác. Không thể xóa/sửa qua API.
