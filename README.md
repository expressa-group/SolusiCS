# Solusics.ai - AI Customer Service Platform

Platform layanan pelanggan bertenaga AI untuk bisnis modern dengan integrasi WhatsApp melalui FonNte.

## Fitur Utama

- **AI Customer Service**: Respons otomatis menggunakan Google Gemini AI
- **Healthcare AI**: Sistem AI khusus untuk layanan kesehatan dengan protokol keamanan medis
- **Multi-tenant**: Setiap pengguna memiliki basis pengetahuan dan AI CS sendiri
- **WhatsApp Integration**: Terintegrasi dengan FonNte webhook untuk WhatsApp Business
- **Knowledge Base Management**: Kelola basis pengetahuan untuk melatih AI
- **Real-time Conversations**: Monitor percakapan AI dengan pelanggan
- **Business Profile Setup**: Konfigurasi informasi bisnis untuk konteks AI

## Teknologi yang Digunakan

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Supabase (Database + Edge Functions)
- **AI**: Google Gemini Pro API
- **WhatsApp**: FonNte API
- **Authentication**: Supabase Auth

## Setup dan Instalasi

### 1. Clone Repository

```bash
git clone <repository-url>
cd solusics-ai
npm install
```

### 2. Konfigurasi Environment Variables

Salin `.env.example` ke `.env` dan isi dengan konfigurasi Anda:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI Configuration (for Supabase Edge Functions)
GEMINI_API_KEY=your_gemini_api_key

# WhatsApp Integration (for Supabase Edge Functions)
FONNTE_TOKEN=your_fonnte_api_token
```

### 3. Setup Database

Jalankan migrasi database di Supabase:

```sql
-- Jalankan file migrasi yang ada di supabase/migrations/
```

### 4. Deploy Edge Functions

Deploy Supabase Edge Functions dan set environment variables:

```bash
# Install Supabase CLI
npm install -g supabase

# Login ke Supabase
supabase login

# Set environment variables untuk Edge Functions
supabase secrets set GEMINI_API_KEY=your_actual_gemini_api_key_here
supabase secrets set FONNTE_TOKEN=your_actual_fonnte_token_here

# Deploy functions
supabase functions deploy ai-cs-webhook
supabase functions deploy ai-cs-test
supabase functions deploy healthcare-ai-webhook --no-verify-jwt
supabase functions deploy healthcare-ai-test
```

**PENTING**: Environment variables untuk Edge Functions harus di-set menggunakan `supabase secrets set`, bukan di file `.env` lokal.

### 5. Konfigurasi FonNte

1. Daftar di [FonNte](https://fonnte.com)
2. Dapatkan API token
3. Setup webhook URL di dashboard FonNte berdasarkan jenis bisnis:

   **Untuk bisnis healthcare:**
   ```
   https://your-supabase-project.supabase.co/functions/v1/healthcare-ai-webhook
   ```

   **Untuk bisnis non-healthcare:**
   ```
   https://your-supabase-project.supabase.co/functions/v1/ai-cs-webhook
   ```

   **PENTING:** Pastikan menggunakan webhook yang sesuai dengan industri bisnis Anda. Sistem akan otomatis mengarahkan jika webhook salah, tapi lebih baik menggunakan yang tepat dari awal.

### 6. Konfigurasi Google Gemini API

1. Buat project di [Google Cloud Console](https://console.cloud.google.com)
2. Aktifkan Generative AI API
3. Buat API key dan masukkan ke environment variables

## Cara Penggunaan

### 1. Setup Bisnis

1. Daftar akun dan verifikasi email
2. Pilih paket berlangganan
3. Isi informasi bisnis (nama, deskripsi, jam operasional, dll)
4. **Khusus Healthcare**: Pilih industri "Kesehatan" untuk mengaktifkan fitur AI medis
4. Tambahkan produk/layanan
5. Buat basis pengetahuan (FAQ, informasi khusus)

### 2. Konfigurasi WhatsApp AI

1. Masuk ke menu "WhatsApp AI"
2. **Untuk Healthcare**: Gunakan menu "WhatsApp AI Medis" dengan protokol keamanan khusus
2. Tambahkan nomor WhatsApp pelanggan yang akan dilayani
3. Test AI response untuk memastikan konfigurasi benar

### 3. Monitoring

- Monitor percakapan real-time di dashboard
- Lihat statistik performa AI
- Analisis waktu respons dan tingkat kepuasan
- **Healthcare**: Monitor khusus untuk keamanan respons medis

## Fitur Khusus Healthcare

### Protokol Keamanan Medis
- AI tidak memberikan diagnosis medis
- Tidak meresepkan obat atau dosis
- Mendeteksi kondisi darurat dan mengarahkan ke IGD
- Validasi keamanan respons otomatis

### Fitur Healthcare
- Manajemen pasien dengan privasi medis
- Sistem janji temu terintegrasi
- Deteksi otomatis kondisi darurat
- Basis pengetahuan medis terstruktur
- Analitik khusus layanan kesehatan
## Arsitektur Sistem

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   WhatsApp      │    │   FonNte API     │    │  Supabase       │
│   Customer/     │◄──►│   Webhook        │◄──►│  Edge Function  │
│   Patient       │    │                  │    │  (General/      │
│                 │    │                  │    │   Healthcare)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │  Google Gemini  │
                                               │  AI API         │
                                               │  (General/      │
                                               │   Healthcare)   │
                                               └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │  Knowledge Base │
                                               │  (Per User)     │
                                               │  + Healthcare   │
                                               │    Protocols    │
                                               └─────────────────┘
```

## Flow Percakapan AI

1. **Pesan Masuk**: Pelanggan mengirim pesan WhatsApp
2. **Webhook**: FonNte mengirim webhook ke Edge Function (General atau Healthcare)
3. **Identifikasi User**: Sistem mencari user_id berdasarkan nomor WhatsApp
4. **Deteksi Industri**: Sistem menentukan apakah bisnis healthcare atau umum
4. **Ambil Konteks**: Mengambil basis pengetahuan spesifik user
5. **Generate AI**: Memanggil Gemini API dengan konteks dan protokol yang sesuai
6. **Validasi Keamanan**: Khusus healthcare - validasi respons untuk keamanan medis
6. **Respons**: Mengirim balasan melalui FonNte API
7. **Log**: Menyimpan percakapan untuk monitoring

## Struktur Database

### Tables

- `user_business_profiles`: Profil bisnis pengguna
- `knowledge_base`: Basis pengetahuan per pengguna
- `whatsapp_users`: Mapping nomor WhatsApp ke user_id
- `ai_conversations`: Log percakapan AI
- `products`: Produk/layanan bisnis
- `faqs`: FAQ bisnis

## API Endpoints

### Edge Functions

- `POST /functions/v1/ai-cs-webhook`: Webhook untuk FonNte
- `POST /functions/v1/ai-cs-test`: Test AI response
- `POST /functions/v1/healthcare-ai-webhook`: Webhook untuk FonNte (Healthcare)
- `POST /functions/v1/healthcare-ai-test`: Test AI response (Healthcare)

## Keamanan

- Row Level Security (RLS) pada semua tabel
- Authentication menggunakan Supabase Auth
- API keys disimpan sebagai environment variables
- Validasi input pada semua endpoint
- **Healthcare**: Protokol keamanan medis tambahan untuk mencegah diagnosis/resep otomatis

## Monitoring dan Analytics

- Real-time conversation logging
- Response time tracking
- User engagement metrics
- AI performance analytics
- **Healthcare**: Monitoring khusus keamanan respons medis

## Troubleshooting

### Common Issues

1. **AI tidak merespons**: Periksa konfigurasi Gemini API key
2. **WhatsApp tidak terhubung**: Verifikasi webhook URL di FonNte
3. **Healthcare AI tidak aman**: Periksa validasi respons dan basis pengetahuan medis
3. **Nomor tidak terdaftar**: Pastikan nomor WhatsApp sudah ditambahkan di sistem

### Logs

Periksa logs di Supabase Edge Functions dashboard untuk debugging.

## Contributing

1. Fork repository
2. Buat feature branch
3. Commit changes
4. Push ke branch
5. Buat Pull Request

## License

MIT License - lihat file LICENSE untuk detail.

## Support

Untuk bantuan teknis, hubungi tim support melalui:
- Email: support@solusics.ai
- WhatsApp: +62 xxx-xxxx-xxxx