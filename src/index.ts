import { loadConfig, isWithinCheckHours, generateDateRange, shouldSendNotifications, Config } from './config';
import { fetchSeatAvailabilityForMultipleDates } from './fetcher';
import { parseSeatAvailability } from './parser';
import { sendTelegramNotification, sendErrorNotification } from './notifier';

const log = (message: string) => console.log(`[${new Date().toISOString()}] ${message}`);

/**
 * Tek bir kontrol turu çalıştırır.
 * Sorgular başarısız olursa hata fırlatır — sessizce "koltuk yok" demez.
 */
async function runCheck(config: Config): Promise<void> {
  if (!isWithinCheckHours(config)) {
    log(`Şu an kontrol saatleri dışında (${config.checkStart} - ${config.checkEnd}). Çıkılıyor.`);
    return;
  }

  const notify = shouldSendNotifications();
  log(`Bildirimler: ${notify ? 'açık' : 'kapalı'}`);

  const datesToCheck = generateDateRange(config);
  log(`${datesToCheck.length} tarih kontrol ediliyor: ${datesToCheck.join(', ')}`);

  const { results, failures } = await fetchSeatAvailabilityForMultipleDates(config, datesToCheck);

  // Hiçbir sorgu başarılı olmadıysa bu bir hatadır, "koltuk yok" değil.
  if (results.length === 0) {
    throw new Error(
      `Hiçbir tarih için veri alınamadı (${failures.length} hata). ` +
      `İlk hata: ${failures[0]?.error.message ?? 'bilinmiyor'}`
    );
  }

  let totalCoaches = 0;

  for (const { date, response } of results) {
    const availability = parseSeatAvailability(response, date);

    if (availability.coaches.length > 0) {
      log(`${date} için ${availability.coaches.length} müsait vagon bulundu!`);
      totalCoaches += availability.coaches.length;

      if (notify) {
        // Bildirim hatası koltuk bulma başarısını gölgelememeli; logla, çalışmayı sürdür.
        try {
          await sendTelegramNotification(config, availability, availability.coaches);
        } catch (error) {
          log(`Bildirim gönderilemedi (${date}): ${(error as Error).message}`);
        }
      }
    }
  }

  if (totalCoaches === 0) {
    log('Hiçbir tarihte boş koltuk bulunamadı');
  }

  // Bazı tarihler başarısız olduysa görünür kıl, ama bulunanları da bildir.
  if (failures.length > 0) {
    log(`UYARI: ${failures.length}/${datesToCheck.length} tarih sorgulanamadı`);
  }

  log('Kontrol tamamlandı');
}

async function main(): Promise<void> {
  log('TCDD Ticket Checker başladı');

  let config: Config | undefined;

  try {
    config = loadConfig();
    log('Yapılandırma yüklendi');

    await runCheck(config);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[${new Date().toISOString()}] Uygulama hatası:`, err.message);

    // Hata bildirimi ancak yapılandırma yüklenebildiyse gönderilebilir.
    if (config && shouldSendNotifications()) {
      await sendErrorNotification(config, err);
    }

    process.exit(1);
  }
}

async function runContinuous(): Promise<void> {
  const config = loadConfig();
  log(`Sürekli mod: ${config.pollIntervalMinutes} dakika aralıkla`);
  log(`Kontrol saatleri: ${config.checkStart} - ${config.checkEnd}`);

  const tick = async () => {
    try {
      await runCheck(config);
    } catch (error) {
      // Sürekli modda tek bir hata döngüyü durdurmaz.
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[${new Date().toISOString()}] Kontrol hatası:`, err.message);
    }
  };

  await tick();
  setInterval(tick, config.pollIntervalMinutes * 60 * 1000);
}

if (process.argv.includes('--continuous')) {
  runContinuous().catch(error => {
    console.error(`[${new Date().toISOString()}] Sürekli modda ölümcül hata:`, error);
    process.exit(1);
  });
} else {
  main();
}
