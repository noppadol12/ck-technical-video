// ===================================================================
// CK Aircond - Technical Video (ระบบเก่า) → ย้ายไประบบใหม่แล้ว
// ลิงก์ Apps Script เดิมยังเปิดได้ แต่จะพาผู้ใช้ไปเว็บใหม่
// ข้อมูลลูกค้า/วิดีโอ/ประวัติ ย้ายไป Supabase + Bunny แล้ว (ไม่อ่าน Sheet อีก)
// ===================================================================

const NEW_URL = 'https://ck-technical-video.pages.dev/';

function doGet() {
  const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <base target="_top">
  <link href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
           background: #F6F8FB; color: #0F172A; font-family: 'Anuphan', system-ui, sans-serif; padding: 24px; }
    .card { width: 100%; max-width: 400px; background: #fff; border: 1px solid #E4E8EF; border-radius: 20px; padding: 32px 24px; text-align: center; }
    .logo { width: 56px; height: 56px; border-radius: 14px; background: #1F5BD8; color: #fff; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 22px; font-weight: 700; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    p { color: #5B6474; font-size: 15px; line-height: 1.6; margin: 0 0 24px; }
    a.btn { display: block; height: 52px; line-height: 52px; border-radius: 12px; background: #1F5BD8; color: #fff; font-weight: 600; font-size: 16px; text-decoration: none; }
    a.btn:hover { background: #1749B0; }
    .url { margin-top: 14px; font-size: 13px; color: #5B6474; word-break: break-all; }
    .note { margin-top: 20px; font-size: 13px; color: #5B6474; }
    .note a { color: #1F5BD8; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">CK</div>
    <h1>ย้ายไปเว็บใหม่แล้ว</h1>
    <p>คลังวิดีโอสอนติดตั้ง CK Technical ย้ายไปที่อยู่ใหม่<br>ใช้รหัสลูกค้าเดิมเข้าสู่ระบบได้เลย</p>
    <a class="btn" href="${NEW_URL}" target="_top">ไปที่เว็บใหม่ →</a>
    <div class="url">${NEW_URL}</div>
    <div class="note">ติดปัญหา ติดต่อ LINE <a href="https://line.me/R/ti/p/@ckaircond" target="_top">@ckaircond</a> หรือโทร 080-826-5970</div>
  </div>
  <script>
    // พยายามพาไปอัตโนมัติ (บางเบราว์เซอร์บล็อก ถ้าไม่ได้ ผู้ใช้กดปุ่มด้านบน)
    setTimeout(function () {
      try { window.top.location.href = '${NEW_URL}'; } catch (e) {}
    }, 1500);
  </script>
</body>
</html>`;

  return HtmlService.createHtmlOutput(html)
    .setTitle('CK Technical — ย้ายไปเว็บใหม่แล้ว')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ฟังก์ชันเดิมที่หน้าเก่าเรียกผ่าน google.script.run
// (กันหน้าเก่าที่ยังเปิดค้างอยู่ไม่ให้ค้าง/error — ไม่อ่านหรือเขียน Sheet แล้ว)
function verifyCustomer() {
  return { success: false, moved: true, url: NEW_URL };
}

function getVideoData() {
  return [];
}

function logVideoView() {
  return { success: false, moved: true };
}
