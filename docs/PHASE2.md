# เฟส 2 — API + หน้าลูกค้า บน Cloudflare Pages

หลังเฟสนี้ ลูกค้าเข้าเว็บใหม่ที่ `ck-technical-video.pages.dev` ด้วยรหัสเดิมได้เลย หน้าตาเหมือนเดิม และระบบจำการล็อกอินไว้ 30 วัน
วิดีโอยังเล่นจาก Google Drive จนกว่าจะทำเฟส 3 ส่วนเว็บ Apps Script เดิมยังเปิดใช้ได้ตามปกติ

## ขั้นที่ 1 — เพิ่มตารางกันเดารหัส

Supabase → **SQL Editor** → **New query** → วางไฟล์ `supabase/phase2.sql` → **Run**

## ขั้นที่ 2 — เอาโค้ดขึ้น GitHub

เอาทั้งโฟลเดอร์ `ck-technical-video` ขึ้น repository `ck-technical-video` ที่สร้างไว้ (private)

ไฟล์ `.gitignore` กันไว้แล้วไม่ให้ไฟล์ข้อมูลลูกค้า (`data/`, `migrate-data.sql`) และไฟล์ key (`.env`, `.dev.vars`) ขึ้นไปด้วย

## ขั้นที่ 3 — สร้างโปรเจกต์บน Cloudflare Pages

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → แท็บ **Pages** → **Connect to Git**
2. เลือก repository `ck-technical-video`
3. ตั้งค่า build:

| ช่อง | ค่า |
| --- | --- |
| Project name | `ck-technical-video` |
| Production branch | `main` |
| Framework preset | None |
| Build command | (เว้นว่าง) |
| Build output directory | `public` |

4. กด **Save and Deploy** รอบแรกจะ deploy ได้ แต่ล็อกอินยังไม่ได้ เพราะยังไม่ได้ใส่ key (ขั้นที่ 4)

## ขั้นที่ 4 — ใส่ key

โปรเจกต์ → **Settings** → **Variables and Secrets** → เพิ่มทีละตัว เลือกชนิด **Secret** ทั้ง 3 ตัว

| ชื่อ | ค่า |
| --- | --- |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` key |
| `SESSION_SECRET` | ข้อความสุ่มยาว 48 ตัวขึ้นไป (วิธีสร้างอยู่ด้านล่าง) |

สร้าง `SESSION_SECRET` บน Mac: เปิด Terminal แล้วพิมพ์ `openssl rand -base64 48` คัดลอกผลลัพธ์ไปใส่

ถ้าเปลี่ยน `SESSION_SECRET` ภายหลัง ลูกค้าทุกคนจะถูกออกจากระบบและต้องใส่รหัสใหม่

จากนั้นไปที่แท็บ **Deployments** → deployment ล่าสุด → **Retry deployment** เพื่อให้ key มีผล

## ขั้นที่ 5 — ทดสอบ (เกณฑ์ผ่านเฟส 2)

เปิด `https://ck-technical-video.pages.dev`

- [ ] รหัสถูกเข้าได้ (พิมพ์เล็ก/ใหญ่ หรือมีช่องว่างก็เข้าได้)
- [ ] รหัสผิดขึ้น "ไม่พบรหัสผู้ใช้งานนี้ในระบบ"
- [ ] ใส่ผิด 5 ครั้งติดกัน ขึ้น "กรุณารอ 5 นาที"
- [ ] ปิดเบราว์เซอร์แล้วเปิดใหม่ ยังล็อกอินอยู่
- [ ] กดดูวิดีโอได้ทั้งบนมือถือและคอม
- [ ] ใน Supabase ตาราง `login_logs` และ `watch_logs` มีแถวใหม่ (`legacy` = false)
- [ ] ปิดสิทธิ์ลูกค้าทดสอบ (`customers.active` = false) แล้วกดหน้าเว็บ ลูกค้าคนนั้นถูกเด้งออก

## ควบคุมลูกค้าจาก Supabase (ใช้ชั่วคราวจนกว่าจะมีหลังบ้านในเฟส 4)

| ต้องการ | ทำใน Table Editor → `customers` |
| --- | --- |
| เพิ่มลูกค้า | Insert row: ใส่ `code` (ตัวพิมพ์ใหญ่) และ `name` วันหมดอายุตั้งให้ 1 ปีอัตโนมัติ |
| ปิดสิทธิ์ | `active` = false |
| ต่ออายุ | แก้ `expires_at` |
| เตะออกจากทุกเครื่อง | เพิ่ม `session_version` อีก 1 |

## สิ่งที่ปลอดภัยขึ้นจากระบบเดิม

- รหัสลูกค้าไม่ถูกเก็บในหน้าเว็บอีกต่อไป ใช้ cookie ที่ JavaScript อ่านไม่ได้และปลอมไม่ได้
- ทุกคำขอเช็กสถานะลูกค้าใหม่จากฐานข้อมูล ปิดสิทธิ์แล้วมีผลทันที
- กันเดารหัส: ผิดเกิน 5 ครั้งใน 5 นาที (ต่อ IP) ต้องรอ
- บันทึกการดูด้วย id วิดีโอจากเซิร์ฟเวอร์ ปลอมชื่อวิดีโอไม่ได้
- ชื่อวิดีโอและหมวดหมู่ถูก escape ก่อนแสดง กันโค้ดแปลกปลอมจากข้อมูล
- เว็บอื่นส่งคำขอ POST มาแทนลูกค้าไม่ได้ (ตรวจ Origin)

ข้อจำกัดที่ยังมีจนกว่าจะทำเฟส 3: ไฟล์บน Drive ยังต้องแชร์แบบ "ทุกคนที่มีลิงก์" ใครได้ลิงก์ Drive ไปก็ยังเปิดดูได้

## แก้หน้าเว็บ (สำหรับนักพัฒนา)

ถ้าแก้ class ของ Tailwind ใน `public/index.html` ต้องรัน `npm run build:css` เพื่อสร้าง `public/styles.css` ใหม่ แล้ว commit ทั้งสองไฟล์
