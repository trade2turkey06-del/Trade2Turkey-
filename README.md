<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.
https://ai.studio/apps/dc5b1b9e-d9cc-4460-9a0c-a0260ae0cfa7

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Firebase istemci ayarları `firebase-applet-config.json` içindedir. Google Drive bağlantısı için `.env.example` dosyasındaki OAuth alanlarını `.env` veya sunucu ortamında tanımlayın. Yapay zekâ API çağrıları ek ücret oluşmaması için kapalıdır; Gemini anahtarı gerekmez.
3. Run the app:
   `npm run dev`

Operasyon akışı, erişim, yedekleme ve test adımları: [Operasyon rehberi](docs/OPERATIONS.md).

Gönderim öncesi `npm run check` çalıştırın. Yerel otomatik gönderim denetimi için `git config core.hooksPath .githooks` kullanın. Gerçek veriden ayrı test ortamı `firebase.test.json` ile tanımlıdır.
