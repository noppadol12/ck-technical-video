# CK Technical Video — เฟส 1: ฐานข้อมูล Supabase + ย้ายข้อมูลจาก Sheet

เฟสนี้สร้างฐานข้อมูลใหม่ และย้ายรหัสลูกค้า วิดีโอ (ยังเป็นลิงก์ Google Drive) และ log เดิมทั้งหมดเข้า Supabase
ระบบ Apps Script เดิมยังใช้งานได้ตามปกติตลอดเฟสนี้ ไม่มีอะไรถูกแก้หรือลบ

## สิ่งที่ต้องมี

- โปรเจกต์ Supabase (region Singapore) จากเฟส 0
- Node.js 20.6 ขึ้นไป (`node -v`)
- สิทธิ์แก้ Google Sheet เดิม

## ขั้นที่ 1 — สร้างตาราง

1. Supabase Dashboard → **SQL Editor** → **New query**
2. คัดลอกทั้งไฟล์ `supabase/schema.sql` ไปวาง แล้วกด **Run**
3. ไปที่ **Table Editor** ต้องเห็น 7 ตาราง: `customers`, `categories`, `videos`, `admins`, `login_logs`, `watch_logs`, `admin_actions`

ไฟล์นี้รันซ้ำได้ ไม่ลบข้อมูลที่มีอยู่

## ขั้นที่ 2 — ปิดการสมัครสมาชิกเอง

Supabase Dashboard → **Authentication** → **Sign In / Providers** → ปิด **Allow new users to sign up**

บัญชีแอดมินจะสร้างโดยคุณเท่านั้น ไม่มีใครสมัครเข้ามาเองได้

## ขั้นที่ 3 — สร้างบัญชีแอดมิน (คุณ)

1. **Authentication** → **Users** → **Add user** → **Create new user**
   ใส่อีเมลและรหัสผ่าน ติ๊ก **Auto Confirm User**
2. **SQL Editor** รันคำสั่งนี้ (เปลี่ยนอีเมลและชื่อเป็นของคุณ)

```sql
insert into public.admins (user_id, name, role)
select id, 'ชื่อของคุณ', 'owner'
from auth.users
where email = 'อีเมลที่ใช้ในข้อ 1';
```

ต้องขึ้น `INSERT 0 1` ถ้าขึ้น `INSERT 0 0` แปลว่าอีเมลไม่ตรง

## ขั้นที่ 4 — Export ข้อมูลจาก Google Sheet

ก่อน export ให้ตั้งรูปแบบวันที่ให้อ่านง่าย (ทำในสำเนาก็ได้):

- ชีต **Logs** และ **WatchLogs** → เลือกคอลัมน์ A → **Format → Number → Custom date and time** → ใส่ `yyyy-mm-dd hh:mm:ss`

จากนั้น export ทีละชีต: เปิดชีต → **File → Download → Comma-separated values (.csv)**
แล้วเปลี่ยนชื่อไฟล์และวางในโฟลเดอร์ `data/` ให้ตรงนี้:

| ชีต | ชื่อไฟล์ |
| --- | --- |
| Customers | `data/Customers.csv` |
| Videos | `data/Videos.csv` |
| Logs | `data/Logs.csv` |
| WatchLogs | `data/WatchLogs.csv` |

ไฟล์ใน `data/` ถูกตั้งไว้ไม่ให้ขึ้น GitHub เพราะมีรหัสลูกค้า

## ขั้นที่ 5 — ตั้งค่าและตรวจข้อมูลก่อนย้าย

```bash
npm install
cp .env.example .env      # แล้วใส่ SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY
npm run migrate:check
```

`migrate:check` อ่านไฟล์อย่างเดียว ไม่เขียนอะไรลง Supabase จะแสดง:

- จำนวนลูกค้า หมวดหมู่ วิดีโอ และ log ที่จะย้าย
- **ข้อควรตรวจ** เช่น รหัสซ้ำ แถวที่ไม่มีลิงก์ วันที่ที่อ่านไม่ได้
- ตัวอย่างรหัส 5 รหัสไว้ทดสอบ

ถ้ามีข้อควรตรวจ ให้แก้ใน Sheet แล้ว export ใหม่ หรือยอมรับได้ก็ไปขั้นต่อไป

## ขั้นที่ 6 — ย้ายจริง

```bash
npm run migrate:commit
```

สคริปต์จะ:

- ทำรหัสลูกค้าเป็นตัวพิมพ์ใหญ่และตัดช่องว่าง เหมือน `isValidCustomer()` เดิม ลูกค้าใช้รหัสเดิมได้เลย
- ตั้งวันหมดอายุรหัสเดิมทุกรหัสเป็น **1 ปีนับจากวันที่ย้าย**
- ดึง Drive file ID ด้วยกติกาเดียวกับ `extractDriveFileId()` เดิม
- สร้างหมวดหมู่จากคอลัมน์ C (ค่าว่าง = "ทั่วไป")
- ย้าย log เก่าทั้งหมด log ของรหัสหรือวิดีโอที่ถูกลบไปแล้วยังย้ายมา แต่ไม่ผูกกับลูกค้า/วิดีโอ

รันซ้ำได้ถ้าแก้ Sheet แล้ว export ใหม่: ลูกค้าและวิดีโอจะอัปเดตทับ ไม่ซ้ำ ส่วน log เก่าจะถูกลบแล้วใส่ใหม่

## ขั้นที่ 7 — ตรวจผล (เกณฑ์ผ่านเฟส 1)

- [ ] จำนวนลูกค้า วิดีโอ และ log ใน Supabase ตรงกับที่ `migrate:check` สรุปไว้
- [ ] รันใน SQL Editor แล้วเจอทั้ง 5 รหัสตัวอย่าง

```sql
select code, name, active, expires_at
from public.customers
where code in ('รหัส1', 'รหัส2', 'รหัส3', 'รหัส4', 'รหัส5');
```

- [ ] `select * from public.video_stats order by total_views desc;` แสดงยอดดูของวิดีโอเดิม
- [ ] ตาราง `admins` มีแถวของคุณ role = `owner`

## ตัวเลือกเพิ่มเติมของสคริปต์

| ตัวเลือก | ใช้เมื่อ |
| --- | --- |
| `--mdy` | วันที่ใน CSV เป็นแบบ เดือน/วัน/ปี (ค่าเริ่มต้นคือ วัน/เดือน/ปี) |
| `--skip-logs` | ย้ายแค่ลูกค้าและวิดีโอ |
| `--dir=./อื่น` | เก็บ CSV ไว้โฟลเดอร์อื่น |

ปี พ.ศ. (เช่น 2569) ถูกแปลงเป็น ค.ศ. ให้อัตโนมัติ และเวลาทั้งหมดถือเป็นเวลาประเทศไทย

## ความปลอดภัย

- `SUPABASE_SERVICE_ROLE_KEY` เข้าถึงข้อมูลได้ทั้งหมด ใช้บนคอมคุณและใน Cloudflare เท่านั้น ห้ามใส่ในโค้ดหน้าเว็บ
- ทุกตารางเปิด Row Level Security และปิดสิทธิ์ `anon` / `authenticated` ไว้ หน้าเว็บอ่านฐานข้อมูลตรงไม่ได้ ต้องผ่าน API เท่านั้น
