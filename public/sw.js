// Service worker ขั้นต่ำ เพื่อให้ติดตั้งเป็นแอปบนมือถือได้
// ไม่แคชข้อมูลใดๆ — ทุกคำขอไปที่เซิร์ฟเวอร์ตามปกติ (ข้อมูลต้องล็อกอินเสมอ)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
