import dotenv from 'dotenv';
import { getTokenInfo } from './auth';

dotenv.config();

/**
 * TCDD_AUTH_TOKEN'ın durumunu gösterir.
 * Kullanım: npm run check:token
 */
function main(): void {
  const token = process.env.TCDD_AUTH_TOKEN || process.env.TRAIN_AUTH_TOKEN;

  if (!token) {
    console.error('❌ TCDD_AUTH_TOKEN tanımlı değil (.env dosyanızı kontrol edin)');
    process.exit(1);
  }

  const info = getTokenInfo(token);

  if (!info) {
    console.error('❌ Token çözümlenemedi — geçerli bir JWT değil.');
    console.error(`   Uzunluk: ${token.length} karakter, nokta sayısı: ${(token.match(/\./g) || []).length} (JWT için 2 olmalı)`);
    console.error('   Muhtemelen token eksik kopyalanmış. Tarayıcıdan tamamını kopyalayın.');
    process.exit(1);
  }

  const expiresAt = info.expiresAt.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });

  if (info.isExpired) {
    console.error(`❌ Token süresi DOLMUŞ (${expiresAt})`);
    console.error('   Yeni token alıp GitHub Secrets > TCDD_AUTH_TOKEN değerini güncelleyin.');
    process.exit(1);
  }

  if (info.expiresSoon) {
    console.warn(`⚠️  Token ${info.daysRemaining} gün sonra doluyor (${expiresAt})`);
    console.warn('   Yakında yenilemeniz gerekecek.');
    return;
  }

  console.log(`✅ Token geçerli — ${info.daysRemaining} gün kaldı (${expiresAt})`);
}

main();
