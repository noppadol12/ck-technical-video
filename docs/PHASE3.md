# เฟส 3 — ย้ายวิดีโอไป Bunny Stream

หลังเฟสนี้ วิดีโอเล่นจาก Bunny ด้วยลิงก์ที่เซ็นจากเซิร์ฟเวอร์และหมดอายุใน 2 ชั่วโมง เล่นได้เฉพาะบนโดเมนของเรา ไม่มีไฟล์ MP4 ให้ดาวน์โหลด
ไฟล์ PDF (หมวด Wiring วงจร) ยังเปิดจาก Google Drive เหมือนเดิม เพราะ Bunny รับเฉพาะวิดีโอ

## ตั้งค่าที่ทำแล้ว

| ที่ | ค่า |
| --- | --- |
| Bunny Library | `ck-technical` (ID 806409) |
| Security | ปิด Direct play · Allowed domains: `ck-technical-video.pages.dev`, `video.ckaircond.com` · เปิด Block direct url file access · เปิด Embed view token authentication |
| Encoding | ปิด MP4 fallback |
| Cloudflare secrets | `BUNNY_LIBRARY_ID`, `BUNNY_CDN_HOSTNAME`, `BUNNY_API_KEY`, `BUNNY_TOKEN_KEY` |
| Webhook (Bunny → API) | `https://ck-technical-video.pages.dev/api/webhooks/bunny` |

## ติดตั้ง (ครั้งเดียว)

Supabase → SQL Editor → วาง `supabase/phase3.sql` → Run (เพิ่มคอลัมน์สถานะการย้าย)

## ย้ายวิดีโอเดิม

หลังบ้าน → **วิดีโอ** → การ์ด "ย้ายวิดีโอจาก Google Drive ไป Bunny" → **ย้ายที่เหลือ N เรื่อง**

- Bunny ดึงไฟล์จาก Google Drive เอง ไม่ผ่านเครื่องเรา (ไฟล์ต้องยังแชร์แบบ "ทุกคนที่มีลิงก์" ระหว่างย้าย)
- ระหว่างย้าย ลูกค้ายังดูจาก Drive ได้ เรื่องไหนแปลงไฟล์เสร็จจะสลับไปเล่นจาก Bunny เอง
- เรื่องที่ย้ายไม่สำเร็จจะขึ้นสีแดงพร้อมเหตุผล และมีปุ่มลองใหม่ (ไอคอนวนลูกศร)

## เพิ่มวิดีโอใหม่

หลังบ้าน → วิดีโอ → **เพิ่มวิดีโอ** → แท็บ **อัปโหลดไฟล์** (ค่าเริ่มต้น)
ไฟล์ขึ้นตรงไป Bunny ไฟล์ใหญ่ได้ เน็ตหลุดอัปต่อได้ ห้ามปิดหน้าระหว่างอัปโหลด
วิดีโอจะแสดงให้ลูกค้าเองเมื่อ Bunny แปลงไฟล์เสร็จ (ปกติไม่กี่นาที)
แท็บ **ลิงก์ Google Drive** ยังใช้ได้ เหมาะกับไฟล์ PDF

## หลังย้ายครบ: ปิดลิงก์ Drive ที่อาจรั่ว

1. เช็กในหลังบ้านว่าวิดีโอทุกเรื่องขึ้นป้าย **Bunny** (ยกเว้น PDF)
2. ลองเปิดวิดีโอจากหน้าลูกค้าบนมือถือและคอม
3. Google Drive → เลือกไฟล์ **วิดีโอ** ทั้งหมด → Share → General access → **Restricted**
   (ไฟล์ PDF ต้องคงไว้เป็น "Anyone with the link" เพราะยังเปิดจาก Drive)
