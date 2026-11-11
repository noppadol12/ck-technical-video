# CK Technical Video

ระบบวิดีโอเทคนิคสำหรับลูกค้า ห้างหุ้นส่วนจำกัด ซี.เค.แอร์คอนด์
Cloudflare Pages (หน้าเว็บ + API) · Supabase (ฐานข้อมูล) · Google Drive → Bunny Stream (วิดีโอ)

| เฟส | คู่มือ | สถานะ |
| --- | --- | --- |
| 1 ฐานข้อมูล + ย้ายข้อมูลจาก Sheet | [docs/PHASE1.md](docs/PHASE1.md) | เสร็จ |
| 2 API + หน้าลูกค้า | [docs/PHASE2.md](docs/PHASE2.md) | กำลังทำ |

## โครงสร้าง

```
public/            หน้าเว็บ (index.html, styles.css, _headers)
functions/api/     API บน Cloudflare Pages Functions
lib/               โค้ดใช้ร่วมกัน (session, ฐานข้อมูล, ตรวจสิทธิ์)
supabase/          SQL สร้างตาราง
scripts/           สคริปต์ย้ายข้อมูลจาก Google Sheet
styles/            ต้นฉบับ Tailwind (build เป็น public/styles.css)
```

## API

| Endpoint | หน้าที่ |
| --- | --- |
| `POST /api/login` | ตรวจรหัสลูกค้า ฝาก cookie 30 วัน |
| `GET /api/me` | ชื่อลูกค้าที่ล็อกอินอยู่ |
| `POST /api/logout` | ออกจากระบบ |
| `GET /api/videos` | รายการวิดีโอที่เปิดแสดง |
| `POST /api/videos/:id/play` | ลิงก์เล่นวิดีโอ + บันทึกการดู |
