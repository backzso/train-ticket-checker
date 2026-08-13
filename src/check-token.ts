import dotenv from 'dotenv';
import { loadConfig } from './config';
import { fetchSeatAvailabilityForDate } from './fetcher';

dotenv.config();

/**
 * TCDD API'sine gerçek bir istek atarak erişimin çalışıp çalışmadığını test eder.
 * Token exp'i denetlenmez (API zaten denetlemiyor); asıl önemli olan API'nin
 * yanıt verip vermediğidir.
 *
 * Kullanım: npm run check:token
 */
async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(`❌ Yapılandırma hatası: ${(error as Error).message}`);
    process.exit(1);
  }

  const today = new Date().toISOString().split('T')[0];
  console.log(`🔍 TCDD API test ediliyor (${config.departureStationName} → ${config.arrivalStationName})...`);

  try {
    const response = await fetchSeatAvailabilityForDate(config, today);
    const trainCount = response.trainLegs?.[0]?.trainAvailabilities?.[0]?.trains?.length ?? 0;
    console.log(`✅ API erişimi çalışıyor — ${trainCount} sefer döndü.`);
  } catch (error) {
    console.error(`❌ API erişimi başarısız: ${(error as Error).message}`);
    console.error('   403 alıyorsanız TCDD nginx katmanı isteği reddediyordur;');
    console.error('   fetcher.ts içindeki tarayıcı başlıklarının güncel olduğundan emin olun.');
    process.exit(1);
  }
}

main();
