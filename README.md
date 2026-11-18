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

### Zing MP3

Tìm kiếm bổ sung từ Zing MP3 qua `/api/zing/search?q=...`, song song với các nguồn hiện có.
Đoạn lời xem trước được lấy tự động qua `/api/zing/lyrics?id=...` với tối đa 3 yêu cầu đồng thời.
Lời tải thành công được lưu tạm tối đa 100 bài trong bộ nhớ trang và dùng lại khi mở bài/tìm lại.
Chọn bài để trình chiếu hoặc lưu như bình thường; lỗi tạm thời có thể thử lại khi mở bài.
Kết quả và lời đều ghi nguồn Zing MP3. Không cần cài thêm thư viện hay biến môi trường.

Hai route chạy Node.js phía máy chủ Next.js, tương thích Vercel. Đây là API web không chính thức;
tham số ký web được tham khảo từ `shin202/zingmp3-api-next` (ISC), chỉ dùng ở server.
Nguồn này có thể đổi hoặc chặn theo vùng/IP. Khi lỗi, các nguồn khác vẫn hoạt động.
Chỉ lấy dữ liệu tìm kiếm và lời do Zing trả về; không tích hợp phát nhạc hay mở nội dung VIP.

Khi kiểm tra trình duyệt, mọi request `/api/zing/*` đều được giả lập để không gọi dịch vụ thật.

Tự động tìm từ 1 ký tự sau khi ngừng gõ 1 giây; Enter/nút tìm chạy ngay.
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

Cuộn theo tốc độ do người dùng chọn, chưa đồng bộ với âm thanh. Luồng lời bài hát không có phát nhạc, hợp âm hoặc đổi tone. API có thể thiếu bài hoặc giới hạn lượt gọi.
Quyền sử dụng lời bài hát cần kiểm tra riêng trước khi kinh doanh.


### YouTube Karaoke

Thêm `YOUTUBE_API_KEY` vào `.env.local` (và biến môi trường máy chủ trên hosting), rồi khởi động lại ứng dụng. Bật YouTube Data API v3 và giới hạn key cho API này. Không dùng tiền tố `NEXT_PUBLIC_`.

Chọn **YouTube Karaoke**, nhập tên bài/tone hoặc dùng micro. Tự động tìm sau khi ngừng gõ 1 giây hoặc nói xong; mỗi trang tối đa 10 video. Từ khóa tự thêm “karaoke” nếu chưa có. Chọn video rồi bấm phát trong player YouTube; player hỗ trợ toàn màn hình. Có liên kết mở trên YouTube nếu video bị chặn nhúng. Kết quả được cache HTTP 5 phút; hạn mức tìm kiếm phụ thuộc project Google Cloud. Không lưu video vào Supabase.


### Quản lý key trong admin

Chạy `supabase/youtube-settings.sql` trong đúng project Supabase. Thêm `SUPABASE_SERVICE_ROLE_KEY` và `ADMIN_EMAIL` vào môi trường máy chủ (local và hosting); không dùng tiền tố NEXT_PUBLIC_. Đăng nhập `/admin` bằng email quản trị, vào mục YouTube Karaoke để lưu key mới hoặc nhập key hiện tại từ môi trường vào database. API xác minh tài khoản qua Supabase Auth. Danh sách chỉ trả trạng thái; nút Xem key gọi riêng API được bảo vệ để hiện giá trị cho quản trị viên. Bảng bật RLS và thu hồi quyền anon/authenticated; chỉ service_role truy cập được. Key database được ưu tiên; khi bảng chưa có bản ghi, dùng YOUTUBE_API_KEY dự phòng. Sau khi nhập thành công, có thể bỏ YOUTUBE_API_KEY khỏi môi trường và khởi động lại.

Multi key: chạy lại `supabase/youtube-settings.sql` để thêm cột keyring, giữ nguyên key cũ. Admin có thể thêm tối đa 20 key có tên gợi nhớ và chọn một key đang dùng. Key mới thêm không tự thay key hiện tại. Key được ẩn mặc định và quản trị viên có thể bấm Xem key. Khi bật bộ đếm bên dưới, tự chuyển sau 100 lượt website ghi nhận; không tự thử lại khi Google báo hết quota.


### Bộ đếm YouTube

Chạy `supabase/youtube-usage.sql` sau `youtube-settings.sql`. Mỗi lần máy chủ chuẩn bị gọi Google sẽ dành trước một lượt trong database, khóa hàng để tránh vượt 100 do nhiều request đồng thời. Key có đủ 100 lượt sẽ được bỏ qua và key còn lượt tiếp theo tự trở thành key đang dùng. Đặt lại số đếm theo ngày America/Los_Angeles (0 giờ PT). Các lượt lỗi/hủy sau khi dành lượt vẫn được tính để tránh đánh giá thấp mức dùng. Cache được phục vụ không gọi route sẽ không tính. Bộ đếm chỉ ghi nhận website từ lúc cài đặt, không phải quota Google còn lại; nhiều key cùng project vẫn chung quota. Không tự thử các key khác khi Google báo quotaExceeded. Khi mọi key đều đạt 100, trả lỗi 429. Admin tải lại trang để xem số đếm.


### Đăng nhập admin

`/admin` dùng Supabase Auth qua email và mật khẩu, không gửi magic link. Tài khoản đã có phiên đăng nhập có thể mở “Đặt / đổi mật khẩu đăng nhập” để đặt mật khẩu (tối thiểu 8 ký tự). Tài khoản cũ chỉ dùng OTP cần đặt mật khẩu qua phiên còn đăng nhập hoặc quy trình khôi phục mật khẩu trong Supabase Authentication trước khi đăng xuất. Không tạo tài khoản hay mật khẩu mặc định. Quyền sửa bài và key vẫn kiểm tra qua RLS và ADMIN_EMAIL.

### Nhận diện và metadata khi deploy

Tên miền chuẩn mặc định: `https://nhacsong.vercel.app`. Khi đổi tên miền, cấu hình `SITE_URL` trên Vercel trước khi build lại, đồng thời sửa tên miền in trên `public/social-card.svg` và xuất lại PNG. Metadata gồm title, description tiếng Việt, canonical trang chủ, Open Graph/Twitter, WebSite JSON-LD, favicon ICO/SVG, Apple icon và manifest với icon 192/512 cùng bản maskable. Ảnh chia sẻ: `public/social-card.png` (1200×630); nguồn vector: `app/icon.svg` và `public/social-card.svg`.

`/sitemap.xml` chỉ có trang chủ. `/admin` có noindex; robots chặn `/admin` và `/api/`. Preview Vercel có noindex và robots chặn toàn bộ, không đưa vào sitemap. Các khai báo robots không thay thế xác thực. Manifest hỗ trợ icon và chế độ standalone, không cung cấp tính năng offline.

Trước khi deploy Production, cấu hình `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL` và chạy các SQL cấu hình YouTube trong project Supabase tương ứng. Không commit `.env.local`. Sau khi deploy, kiểm tra `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, favicon và ảnh chia sẻ; gửi sitemap trong Google Search Console nếu đã xác minh quyền sở hữu. Chưa có mã xác minh Search Console nên không khai báo mã giả.
