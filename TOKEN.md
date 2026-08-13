# TCDD Kimlik Doğrulama — Nasıl Çalışıyor (ve neden bir gün bozulabilir)

Bu dosya, projenin TCDD API'sine nasıl eriştiğini açıklar. Bir gün `403`
almaya başlarsan, buraya bak.

## Kısa özet

**TCDD'nin arama API'si token'ı gerçekten denetlemez.** Erişim iki katmanda
belirlenir:

1. **nginx katmanı** — isteğin gerçek bir tarayıcıdan gelip gelmediğine bakar
   (User-Agent, Referer, Origin, sec-* başlıkları). Bu başlıklar eksikse
   **istek uygulamaya ulaşmadan `403` döner.** Asıl kapı budur.
2. **Uygulama katmanı** — bir `Authorization` başlığı bekler, ama içindeki
   JWT'nin **süresini (`exp`) kontrol etmez.** Süresi 2024'te dolmuş bir token
   bile kabul edilir.

Yani: **doğru başlıklar = erişim. Token neredeyse önemsiz.**

## Kanıt (13 Ağustos 2026'da test edildi)

Aynı dolmuş token ile:

| İstek | Sonuç |
|---|---|
| Auth başlığı yok, tarayıcı başlıkları yok | `403` (nginx) |
| Dolmuş token + tarayıcı başlıkları YOK | `403` (nginx) |
| Dolmuş token + **tam tarayıcı başlıkları** | `200` ✅ (301 KB gerçek veri) |
| Tarayıcı başlıkları var ama **User-Agent yok** | `403` (nginx) |

Ek olarak: arka arkaya çok istek atılırsa **rate-limit** devreye girip `403`
döner; kısa bir bekleme sonrası tekrar `200` olur.

## Kodda nerede

### Gömülü token — `src/auth.ts`
`EMBEDDED_PROD_TOKEN`, TCDD'nin kendi tarayıcı bundle'ındaki
`case "TCDD-PROD"` dalından alınmıştır. `exp`'i denetlenmez; olduğu gibi
gönderilir. İstersen `TCDD_AUTH_TOKEN` env değişkeni ile kendi token'ını
geçebilirsin, ama gerekli değildir.

### Tarayıcı başlıkları — `src/fetcher.ts`
İsteğe eklenen kritik başlıklar (biri bile eksikse `403` riski):

```
User-Agent:        gerçek Chrome UA (şart)
Referer:           https://ebilet.tcddtasimacilik.gov.tr/
Origin:            https://ebilet.tcddtasimacilik.gov.tr
sec-ch-ua / sec-ch-ua-mobile / sec-ch-ua-platform
sec-fetch-dest / sec-fetch-mode / sec-fetch-site
unit-id:           3895 (PROD)
```

Ayrıca tarihler arası **3 saniye** gecikme var (rate-limit'e karşı).

## `403` almaya başlarsan — kontrol listesi

1. **Rate-limit mi?** Birkaç dakika bekleyip tek istek at. Geçiyorsa sorun
   sıklıktı; `fetcher.ts`'deki gecikmeyi artır.
2. **Başlıklar eskidi mi?** TCDD siteyi güncellemiş olabilir. Tarayıcıda
   ebilet.tcddtasimacilik.gov.tr'de arama yap → DevTools → Network →
   `train-availability` isteği → sağ tık → **Copy → Copy as cURL**. Oradaki
   başlıkları `src/fetcher.ts` ile karşılaştır, farklı olanları güncelle.
3. **Token değişti mi?** DevTools'taki isteğin `Authorization` başlığındaki
   değeri `src/auth.ts` içindeki `EMBEDDED_PROD_TOKEN` ile karşılaştır.
   Farklıysa güncelle. (Token muhtemelen hâlâ aynıdır — asıl neden genelde
   başlıklardır.)
4. **Bağlantıyı hızlı test et:** `npm run check:token`

## Neden bu şekilde (env'e token koymak yerine)

TCDD token'ları 60 saniye ömürlü. Günde bir çalışan bir cron için env'e/secret'a
token koymak işe yaramaz — token bir sonraki çalıştırmadan çok önce "dolar".
API `exp`'i denetlemediği için, sabit gömülü token pratikte en dayanıklı çözüm.

## Geçmiş (bir daha aynı tuzağa düşmemek için)

- Proje başında token `auth.ts`'e hardcoded'dı ve `exp`'i elle uzatılmıştı
  (2025-10-25). Bu, "token 15 ay yaşıyor" yanılgısına yol açtı — gerçekte
  60 saniyeydi ve sunucu zaten denetlemiyordu.
- `TRAIN_*` / `TCDD_*` env adı uyuşmazlığı botu ~1 ay sessizce kırdı.
- Asıl `403` sebebi Ekim 2025'te eklenen nginx tarayıcı-doğrulamasıydı;
  çözüm token değil, tam tarayıcı başlık setiydi.
