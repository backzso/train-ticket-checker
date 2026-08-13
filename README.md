# Train Ticket Checker

TCDD seferlerinde boş koltuk arayıp bulduğunda Telegram'dan bildirim gönderen araç.

İki çalışma biçimi var:

| Mod | Komut | Ne yapar |
|---|---|---|
| **Tek seferlik** | `npm start` | Bir kez kontrol eder, çıkar. GitHub Actions bunu kullanır. |
| **Sürekli** | `npm run start:continuous` | Belirlenen aralıkla kendi kendine kontrol eder. |
| **İnteraktif bot** | `npm run start:bot` | Telegram'dan komutlarla yönetilen sunucu. |

## Kurulum

```bash
npm install
cp env.example .env   # .env içini doldurun
npm run build
npm start
```

## TCDD token'ı alma

Token uzun ömürlüdür (~15 ay), sık sık yenilemek gerekmez.

1. Tarayıcıda [ebilet.tcddtasimacilik.gov.tr](https://ebilet.tcddtasimacilik.gov.tr) adresinde bir sefer araması yapın
2. DevTools → **Network** sekmesini açın
3. `train-availability` isteğine tıklayın → **Headers**
4. `Authorization` başlığının **tam** değerini kopyalayın (uzun bir JWT'dir, ~1000+ karakter)
5. `.env` içindeki `TCDD_AUTH_TOKEN` değerine yapıştırın

Token'ın durumunu kontrol etmek için:

```bash
npm run check:token
```

Süresi dolmasına 7 gün kalınca Telegram'dan otomatik uyarı gelir.

## Yapılandırma

Tüm ayarlar `.env` üzerinden yapılır — açıklamalar için `env.example` dosyasına bakın.

Öne çıkanlar:

- `CHECK_START` / `CHECK_END` — kontrolün yapılacağı saat aralığı (Türkiye saati)
- `CHECK_MULTIPLE_DATES` — `true` ise bugünden itibaren `MAX_DAYS_TO_CHECK` gün taranır
- `SEND_NOTIFICATIONS` — **varsayılan açık**; kapatmak için açıkça `false` yazın

## GitHub Actions ile otomatik çalıştırma

Workflow her gün 09:00 UTC'de (Türkiye saatiyle 12:00) çalışır, ayrıca Actions sekmesinden elle tetiklenebilir.

Gereken secret'lar **Settings → Secrets and variables → Actions** altında tanımlanır:

```
TCDD_ENDPOINT            DEPARTURE_STATION_ID     DEPARTURE_STATION_NAME
TCDD_AUTH_TOKEN          ARRIVAL_STATION_ID       ARRIVAL_STATION_NAME
UNIT_ID                  DEPARTURE_DATE           CHECK_START
CHECK_END                POLL_INTERVAL_MINUTES    CHECK_MULTIPLE_DATES
MAX_DAYS_TO_CHECK        TELEGRAM_BOT_TOKEN       TELEGRAM_CHAT_ID
SEND_NOTIFICATIONS
```

Sorgular başarısız olursa iş **hata verir** (yeşil görünüp sessizce hiçbir şey yapmaz durumda kalmaz) ve hata Telegram'a bildirilir.

## İnteraktif Telegram botu

```bash
npm run start:bot
```

Komutlar:

| Komut | Açıklama |
|---|---|
| `/check` | Otomatik kontrolü başlat |
| `/now` | Hemen bir kez kontrol et |
| `/stop` | Kontrolü durdur |
| `/status` | Mevcut durumu göster |
| `/stations` | Desteklenen istasyonlar |
| `/setroute ankara istanbul` | Güzergah ayarla |
| `/setdate 2025-12-30` | Tarih ayarla |
| `/setinterval 15` | Kontrol aralığı (dakika) |

Ayarlar `bot-state.json` dosyasında saklanır; sunucu yeniden başladığında aktif kontroller kaldığı yerden devam eder.

### Webhook kurulumu

`PUBLIC_URL` tanımlıysa bot açılışta webhook'u kendisi kurar:

```bash
PUBLIC_URL=https://your-app.onrender.com
WEBHOOK_SECRET=rastgele_bir_dize
```

`WEBHOOK_SECRET` verildiğinde, doğru anahtarı taşımayan istekler `401` ile reddedilir. Elle kurmak isterseniz:

```bash
curl -F "url=https://<adresiniz>/webhook" \
     https://api.telegram.org/bot<TOKEN>/setWebhook
```

## Sorun giderme

| Belirti | Sebep |
|---|---|
| `Missing required environment variables` | `.env` eksik veya adlar hatalı. Eski `TRAIN_*` adları da kabul edilir. |
| `kimlik doğrulama hatası (403)` | Token geçersiz/eksik kopyalanmış. `npm run check:token` çalıştırın. |
| `Token çözümlenemedi` | Token eksik kopyalanmış — JWT 2 nokta içerir ve çok uzundur. |
| Telegram `404` | `TELEGRAM_BOT_TOKEN` veya `TELEGRAM_CHAT_ID` hatalı. |
| Koltuk bulunuyor ama bildirim yok | `SEND_NOTIFICATIONS=false` olabilir. |

## Notlar

Yalnızca herkese açık bilet arama ucunu, kendi hesabınızın token'ıyla, makul sıklıkta sorgular. Otomatik satın alma yapmaz.
