---
title: ML Service - Sales & Inventory Analytics
emoji: 📊
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# ML Service — Sales & Inventory Analytics

Internal FastAPI ML service untuk prediksi stok, permintaan, dan pendapatan.

## Endpoints

| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/health` | Health check |
| GET | `/docs` | Swagger UI (dokumentasi interaktif) |
| POST | `/predict-stock` | Prediksi kehabisan stok |
| POST | `/predict-demand` | Prediksi permintaan harian/mingguan |
| POST | `/predict-revenue` | Prediksi pendapatan + forecast 7 hari |

> **Note**: Semua endpoint `/predict-*` membutuhkan header `X-Internal-Service-Key`.
> Service ini dirancang untuk dipanggil oleh Express API backend, bukan langsung dari frontend.
