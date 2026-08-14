# Train Ticket Checker

TCDD seferlerinde boş koltuk arayıp bulduğunda Telegram'dan bildirim gönderen araç.

İki çalışma biçimi var:

| Mod | Komut | Ne yapar |
|---|---|---|
| **Tek seferlik** | `npm start` | Bir kez kontrol eder, çıkar. |
| **Sürekli** | `npm run start:continuous` | Belirlenen aralıkla kendi kendine kontrol eder. GitHub Actions bunu kullanır. |
| **İnteraktif bot** | `npm run start:bot` | Telegram'dan komutlarla yönetilen sunucu (ayrı deploy gerekir). |

## Kurulum

```bash
npm install
cp env.example .env   # .env içini doldurun
npm run build
npm start
```

## Kimlik doğrulama

TCDD'nin arama API'si, token yerine isteğin **gerçek bir tarayıcıdan** gelip
gelmediğine bakarak erişimi denetler. Bu yüzden:

- **Token gerekmez.** TCDD web uygulamasının kendisi de sabit, "süresi dolmuş"
  bir token kullanır; API `exp` alanını denetlemez. Bu token `src/auth.ts`
  içine gömülüdür, bir şey ayarlamanıza gerek yoktur.
- **Asıl önemli olan başlıklardır.** `src/fetcher.ts`, gerçek Chrome'un
  gönderdiği başlık setini (`User-Agent`, `Referer`, `Origin`, `sec-*`) taklit
  eder. Bunlar eksik olursa API `403` döner.

İsterseniz kendi token'ınızı `TCDD_AUTH_TOKEN` ile geçebilirsiniz, ama gerekli
değildir.

API erişiminin çalışıp çalışmadığını test etmek için:

```bash
npm run check:token
```

> **Not:** TCDD bir gün tarayıcı uygulamasını güncellerse, `src/auth.ts`
> içindeki gömülü token veya `src/fetcher.ts` içindeki başlıklar güncellenmesi
> gerekebilir. `403` alırsanız ilk buraya bakın.

## Yapılandırma

Tüm ayarlar `.env` üzerinden yapılır — açıklamalar için `env.example` dosyasına bakın.

Öne çıkanlar:

- `CHECK_START` / `CHECK_END` — kontrolün yapılacağı saat aralığı (Türkiye saati)
- `CHECK_MULTIPLE_DATES` — `true` ise bugünden itibaren `MAX_DAYS_TO_CHECK` gün taranır
- `SEND_NOTIFICATIONS` — **varsayılan açık**; kapatmak için açıkça `false` yazın

## GitHub Actions ile otomatik çalıştırma

Workflow, Türkiye saatiyle ~07:00-23:00 arası **her saat başı** tetiklenir.
Her tetikleme **sürekli modda ~55 dakika** çalışıp **5 dakikada bir** kontrol
eder, sonra düzgünce çıkar. Böylece gün boyunca neredeyse kesintisiz, sık
kontrol olur — aynı gün iptalden boşalan koltuğu yakalamak için.

Aranan tarih için `CHECK_TODAY: 'true'` workflow'da sabit; yani **her zaman
o günü** kontrol eder, `DEPARTURE_DATE` secret'ını elle güncellemeye gerek
yoktur. Kapsama saatlerini `CHECK_START` / `CHECK_END` secret'larıyla
sınırlarsın (Türkiye saati).

> **Not:** GitHub'ın scheduled cron'u yoğunlukta gecikebilir/atlanabilir; bu
> yüzden aralığı cron'a değil, iş içindeki 5 dakikalık döngüye bıraktık. Public
> repo'da Actions dakikaları ücretsizdir.

Gereken secret'lar **Settings → Secrets and variables → Actions** altında
tanımlanır:

```
TCDD_ENDPOINT            DEPARTURE_STATION_ID     DEPARTURE_STATION_NAME
ARRIVAL_STATION_ID       ARRIVAL_STATION_NAME     UNIT_ID
CHECK_START              CHECK_END                DEPARTURE_DATE
TELEGRAM_BOT_TOKEN       TELEGRAM_CHAT_ID         SEND_NOTIFICATIONS
```

`TCDD_AUTH_TOKEN` gerekmez (gömülü token kullanılır). `POLL_INTERVAL_MINUTES`,
`MAX_RUNTIME_MINUTES`, `CHECK_TODAY`, `CHECK_MULTIPLE_DATES` workflow içinde
sabittir; `DEPARTURE_DATE` yalnızca `CHECK_TODAY` kapatılırsa kullanılır.

Sorgular başarısız olursa iş **hata verir** (yeşil görünüp sessizce hiçbir şey
yapmaz durumda kalmaz) ve hata Telegram'a bildirilir.

## İnteraktif Telegram botu

```bash
npm run start:bot
```

Komutlar:

| Komut | Açıklama |
|---|---|
| `/check` | Otomatik kontrolü başlat |
| `/now` | Hemen bir kez kontrol et |
| `/stop` | Otomatik kontrolü durdur |
| `/status` | Mevcut ayarları göster |
| `/setroute ankara istanbul` | Güzergah ayarla |
| `/swap` | Kalkış ↔ varış yönünü ters çevir |
| `/setdate 2025-12-30` | Aranacak tarihi ayarla |
| `/multi 7` | Bugünden itibaren N gün tara (0 = kapat) |
| `/stations` | Desteklenen istasyonlar |
| `/setinterval 15` | Kontrol aralığı (dakika) |
| `/settime 08:00 22:00` | Sadece bu saatler arası bildir |
| `/reset` | Ayarları varsayılana döndür |
| `/help` | Yardım ve komut listesi |

Bot açılışta bu komutları Telegram'ın komut menüsüne de kaydeder; kullanıcı `/`
yazınca komutlar açıklamalarıyla listelenir.

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
| `isteği başarısız (403)` | nginx isteği eledi — `src/fetcher.ts` başlıkları güncel değil. |
| `isteği başarısız (400)` | `DEPARTURE_DATE` geçmişte veya biçimi hatalı. |
| Telegram `404` | `TELEGRAM_BOT_TOKEN` veya `TELEGRAM_CHAT_ID` hatalı. |
| Koltuk bulunuyor ama bildirim yok | `SEND_NOTIFICATIONS=false` olabilir. |

## Notlar

Yalnızca herkese açık bilet arama ucunu, kendi hesabınızın token'ıyla, makul sıklıkta sorgular. Otomatik satın alma yapmaz.
