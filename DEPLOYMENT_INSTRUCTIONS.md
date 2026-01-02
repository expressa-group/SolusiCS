# Deployment Instructions for Supabase Edge Functions

## Important: Public Functions Deployment

Beberapa Edge Functions perlu di-deploy dengan flag `--no-verify-jwt` agar dapat diakses secara publik tanpa header authorization:

### Functions yang memerlukan --no-verify-jwt:

1. **get-public-order-details** - Untuk halaman konfirmasi pembayaran
2. **update-order-status-public** - Untuk update status pesanan dari halaman publik
3. **midtrans-notification** - Untuk webhook Midtrans
4. **healthcare-ai-webhook** - Untuk webhook AI khusus healthcare

### Perintah Deploy yang Benar:

```bash
# Deploy functions yang memerlukan public access
supabase functions deploy get-public-order-details --no-verify-jwt
supabase functions deploy update-order-status-public --no-verify-jwt
supabase functions deploy midtrans-notification --no-verify-jwt
supabase functions deploy healthcare-ai-webhook --no-verify-jwt

# Deploy functions yang memerlukan authentication
supabase functions deploy ai-cs-webhook
supabase functions deploy ai-cs-test
supabase functions deploy healthcare-ai-test
supabase functions deploy rag-search
supabase functions deploy rag-batch-process
supabase functions deploy fonnte-device-manager
supabase functions deploy create-midtrans-transaction
supabase functions deploy create-order-payment
supabase functions deploy whatsapp-blast-sender
supabase functions deploy admin-api
supabase functions deploy order-handler
```

### Set Environment Variables:

```bash
supabase secrets set GEMINI_API_KEY=your_actual_gemini_api_key_here
supabase secrets set FONNTE_TOKEN=your_actual_fonnte_token_here
supabase secrets set MIDTRANS_SERVER_KEY=your_actual_midtrans_server_key_here
supabase secrets set PUBLIC_FRONTEND_URL=https://spectacular-kashata-ded1e0.netlify.app
```

### Webhook URLs untuk Healthcare:

**PENTING: Konfigurasi Webhook Berdasarkan Industri**

Untuk bisnis healthcare, gunakan webhook URL healthcare:
```
https://your-supabase-project.supabase.co/functions/v1/healthcare-ai-webhook
```

Untuk bisnis non-healthcare (retail, ecommerce, dll), gunakan webhook URL umum:
```
https://your-supabase-project.supabase.co/functions/v1/ai-cs-webhook
```

**Catatan:** Jika Anda menggunakan webhook yang salah:
- Healthcare business di general webhook akan otomatis diredirect ke healthcare webhook
- Non-healthcare business di healthcare webhook akan ditolak

**Rekomendasi:** Gunakan webhook yang sesuai dengan industri bisnis Anda untuk performa optimal.

### Troubleshooting:

Jika masih mendapat error 401 setelah deploy:
1. Pastikan menggunakan flag `--no-verify-jwt`
2. Tunggu beberapa menit untuk propagasi
3. Coba akses ulang link pembayaran

### Verifikasi Deployment:

Untuk memverifikasi bahwa functions sudah ter-deploy dengan benar:

```bash
supabase functions list
```

Pastikan functions yang memerlukan public access tidak memiliki JWT verification enabled.