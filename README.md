<p align="center">
   <img width="50%" alt="logo" src="https://www.virtualpbx.com/wp-content/uploads/2024/04/Screenshot-2024-04-11-at-1.55.42%E2%80%AFPM-1024x500.png" />
</p>

# Hướng dẫn Triển khai Local

## ⚠️ Yêu cầu (Prerequisites)
Để deploy trên localhost, **BẮT BUỘC** phải cài đặt:
- **Docker Desktop** (Dành cho Windows/Mac) hoặc Docker Engine & Docker Compose (Dành cho Linux).

## 🔰 Các bước chạy dự án

### Bước 1: Khởi động hệ thống
1. Clone repo về thư mục project
   ``` bash
   git clone https://github.com/eiuthanghuynh/fai-lab-system
   ```
2. Mở Terminal và trỏ (`cd`) vào thư mục gốc của dự án hoặc chuột phải vào trong thư mục và chọn `Open in Terminal`.

   **Lưu ý**: Chắc chắn thư mục gốc được trỏ đã có file `docker-compose.yml`
   <p align="center">
      <img width="50%" alt="image" src="https://github.com/user-attachments/assets/e656615d-0340-46a4-886b-a378253b154e" />
   </p>
3. Chạy lệnh sau để tải và khởi động toàn bộ các dịch vụ:
   ```bash
   docker-compose up -d --build
   ```
   *(Lệnh này sẽ tự động tải các image PostgreSQL, Redis, MinIO, Node.js và cài đặt các package npm cho Frontend/Backend. Hãy kiên nhẫn chờ khoảng 1-3 phút trong lần chạy đầu tiên).*

### Bước 2: Đồng bộ Database (Prisma)
Khi init xong, database sẽ trống dữ liệu. Ta tiến hành load cấu trúc bảng (schema) vào PostgreSQL thông qua container của Backend.
1. Vẫn ở Terminal đó, chạy lệnh đẩy Schema vào DB:
   ```bash
   docker exec -it fai_backend npx prisma db push
   ```
2. Chạy lệnh tạo data mẫu (bao gồm user `admin` để có thể truy cập web)
   ```bash
   docker exec -it fai_backend npx prisma db seed
   ```

### Bước 3: Truy cập hệ thống
Sau khi các bước trên thành công, các web đã chạy bình thường ở các địa chỉ sau:

- **Frontend (Giao diện người dùng):** [http://localhost:5173](http://localhost:5173) (User: `admin` / Pass: `xp`)
- **Backend (API):** [http://localhost:3000](http://localhost:3000)
- **Database (PostgreSQL):** Chạy ở cổng `5434` (User: `postgres` / Pass: `123456789` / DB: `fai_lab_db`)
- **MinIO (Giao diện quản lý file):** [http://localhost:9001](http://localhost:9001) (User: `minioadmin` / Pass: `minioadmin123`)

---

## ℹ️ Một số lệnh quản lý thường dùng
- Để xem log (lỗi) của Backend:
  ```bash
  docker logs fai_backend -f
  ```
- Để xem log của Frontend:
  ```bash
  docker logs fai_frontend -f
  ```
- Để dừng hệ thống (Tắt máy):
  ```bash
  docker-compose down
  ```
