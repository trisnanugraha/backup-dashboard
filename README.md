# Backup Monitoring Dashboard v2

Pengganti monitoring backup & verify Kopia berbasis Node-RED, dengan stack MySQL 8 + n8n (ingest) + REST API + dashboard React.
Sistem ini dibangun **paralel**: Node-RED tetap berjalan dan tetap jadi sumber data produksi sampai switch-over manual.

| Tahap | Isi | Status |
|---|---|---|
| 1 | Skema MySQL (`db/schema.sql`) | selesai, teruji |
| 2 | Workflow ingest n8n (`n8n/`) | selesai, teruji |
| 3 | `GET /api/dashboard` | selesai, teruji |
| 4 | `/api/history`, `/api/history/groups`, `/api/notes`, `/api/categories`, `/api/report/*` | selesai, teruji |
| 5–6 | Dashboard React (Dashboard + History) | belum |
| 7 | Laporan PDF + Telegram/Nextcloud | belum (endpoint datanya sudah ada) |

## Struktur

```
db/schema.sql            skema MySQL (idempotent, dipasang otomatis oleh container mysql)
n8n/src/normalize.js     logic Code node (validasi payload, fallback severity -> WARN)
n8n/src/sql.js           query MySQL node (set-based via JSON_TABLE)
n8n/workflows/*.json     workflow siap import (hasil generate, jangan edit manual)
scripts/build-n8n.js     generator workflow dari n8n/src
api/                     REST API Express + mysql2
docker-compose.yml       mysql + api (+ n8n via profile)
```

## Menjalankan

```bash
cp .env.example .env        # isi MYSQL_ROOT_PASSWORD, MYSQL_USER, MYSQL_PASSWORD
docker compose up -d --build
curl -s localhost:3000/api/health
```

Kalau belum punya instance n8n: `docker compose --profile n8n up -d`.
Kalau MySQL sudah ada di server lain, jalankan `db/schema.sql` manual lalu arahkan `MYSQL_HOST` ke sana.

> `db/schema.sql` hanya dieksekusi otomatis saat volume `mysql-data` masih kosong (inisialisasi pertama).

## n8n (ingest)

1. Di n8n buat credential **MySQL** (host/user/password dari `.env`), beri nama `MySQL backup_monitoring`.
2. Import `n8n/workflows/kopia-backup.json` dan `kopia-verify.json`
   (UI: *Workflows → Import from File*, atau CLI: `docker compose exec n8n n8n import:workflow --input=/workflows/kopia-backup.json`).
3. Buka tiap node MySQL, pilih credential tadi, lalu **Activate** workflow.
4. Endpoint: `POST /webhook/kopia-backup` dan `POST /webhook/kopia-verify`.

Uji dengan payload dummy:

```bash
curl -s -X POST http://localhost:5678/webhook/kopia-backup -H 'Content-Type: application/json' -d '{
  "group": "backup-to-drc-containers",
  "summary": [{"host": "tangerangkota-drc", "status": "OK", "error_reason": ""}]
}'
# {"ok":true,"group":"backup-to-drc-containers","received":1,"warnings":[]}
```

Diuji end-to-end di n8n 2.40.6 (MySQL node typeVersion 2.4) + MySQL 8.0.

Perilaku ingest:
- `reported_at` = waktu laporan diterima (UTC), `report_date` = tanggal WIB saat diterima. Keduanya pakai `UTC_TIMESTAMP()`, jadi tidak tergantung timezone session MySQL.
- `severity` verify kosong / tidak dikenal → disimpan sebagai **WARN** dan dicatat di `warnings` response (tidak pernah default ke CRITICAL).
- `status` backup selain `OK` → `ERROR`. Host/domain kosong di-skip dan masuk `warnings`.
- Host/domain yang pindah group mengikuti group laporan terakhir; record lama tetap menyimpan group saat itu.
- Payload tanpa `group` / `summary` bukan array → workflow error, webhook membalas HTTP 500 (Cronicle melihatnya sebagai gagal).
- Parameter ke MySQL node dikirim dalam bentuk base64 lalu di-decode dengan `FROM_BASE64()` di SQL. Alasannya: field *Query Parameters* di MySQL node n8n memecah nilai berdasarkan koma (ekspresi array pun dijadikan string dulu), sehingga JSON atau nama group yang mengandung koma akan rusak. Nilai tetap dikirim sebagai parameter, bukan disisipkan ke teks SQL.

Kalau logic ingest diubah, edit `n8n/src/*` lalu jalankan `node scripts/build-n8n.js` dan import ulang.

## API

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/health` | cek koneksi DB |
| GET | `/api/dashboard` | seluruh data dashboard (window berjalan + kemarin, trend 30 hari, top fail, status per group, verify) |
| GET | `/api/history/groups` | daftar group untuk sidebar History |
| GET | `/api/history?group=<nama>` | detail 30 hari satu group |
| POST | `/api/notes` | `{entity_type, entity_key, note, category}`; `note` kosong = hapus |
| POST | `/api/categories` | `{domain, category}` atau `{mappings:[...]}`; baris invalid masuk `invalidRows` |
| GET | `/api/report/daily` | data laporan harian (window kemarin) |
| GET | `/api/report/monthly?month=YYYY-MM` | data laporan bulanan (default: bulan lalu); `?preview=1` = tgl 1 s/d hari ini |

### Window operasional

Siklus dipotong jam 17:00 WIB (10:00 UTC), bukan 00:00 (`api/src/lib/time.js`):
- **Berjalan**: `[17:00 WIB terakhir, sekarang]`
- **Kemarin**: `[17:00 WIB H-2, 17:00 WIB H-1)`. Batas akhir eksklusif, jadi record tepat 17:00:00 masuk window berjalan, tidak dihitung dua kali.

Dalam satu window, tiap host/app diambil record **terbarunya** saja (`ROW_NUMBER() OVER (PARTITION BY host_id ...)`), jadi retry tidak dihitung ganda. Agregasi harian (trend, history, heatmap) memakai pola yang sama per `(host, report_date)`.

Group **belum lapor** = ada record backup di window kemarin tapi tidak ada di window berjalan; `usual_report_time` = jam WIB laporan terakhirnya di window kemarin.

Field tambahan di luar kontrak Node-RED (tidak mengubah field yang ada):
- `calendarBackup` / `calendarVerify` di `/api/dashboard`, serta `calendar_backup` / `calendar_verify` di `/api/history`: success rate harian ~6 bulan untuk heatmap kalender.
- `note_active` di `todaySummary`, `generatedAt`.

## Test

```bash
cd api && npm ci
npm test                                                   # unit test
MYSQL_TEST_URL=mysql://user:pass@127.0.0.1:3306 npm test   # + integration (buat & hapus DB backup_monitoring_test)
```
