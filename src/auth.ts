import { Config } from './config';

/** Token süresinin dolmasına bu kadar gün kalınca uyarı gönderilir. */
export const TOKEN_WARNING_DAYS = 7;

export interface TokenInfo {
  expiresAt: Date;
  daysRemaining: number;
  isExpired: boolean;
  expiresSoon: boolean;
}

/**
 * JWT'nin payload'ını çözer. Başarısız olursa null döner.
 */
function decodeTokenPayload(token: string): { exp?: number } | null {
  try {
    const raw = token.replace(/^Bearer\s+/i, '');
    const parts = raw.split('.');
    if (parts.length < 2) return null;

    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Token'ın son kullanma bilgisini çıkarır.
 * Çözülemeyen veya exp içermeyen token'lar için null döner.
 */
export function getTokenInfo(token: string): TokenInfo | null {
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) return null;

  const expiresAt = new Date(payload.exp * 1000);
  const msRemaining = expiresAt.getTime() - Date.now();
  const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24));

  return {
    expiresAt,
    daysRemaining,
    isExpired: msRemaining <= 0,
    expiresSoon: msRemaining > 0 && daysRemaining <= TOKEN_WARNING_DAYS
  };
}

/**
 * Token'ın süresinin dolup dolmadığını kontrol eder.
 * Çözülemeyen token'lar geçersiz sayılır.
 */
export function isTokenExpired(token: string): boolean {
  const info = getTokenInfo(token);
  return info === null ? true : info.isExpired;
}

/**
 * Yapılandırmadaki token'ı doğrular ve döndürür.
 *
 * TCDD token'ları uzun ömürlüdür (~15 ay), bu yüzden otomatik yenileme yoktur.
 * Süresi dolduğunda tarayıcıdan yeni token alınıp TCDD_AUTH_TOKEN secret'ı
 * güncellenmelidir.
 */
export function resolveAuthToken(config: Config): string {
  if (!config.trainAuthToken) {
    throw new Error(
      'TCDD_AUTH_TOKEN tanımlı değil. Tarayıcıdan yeni bir token alıp ' +
      'GitHub Secrets içine ekleyin.'
    );
  }

  const info = getTokenInfo(config.trainAuthToken);

  if (info === null) {
    // Çözülemeyen token'ı reddetmiyoruz; JWT olmayan bir format olabilir.
    console.warn(
      `[${new Date().toISOString()}] TCDD_AUTH_TOKEN çözümlenemedi, ` +
      `son kullanma tarihi doğrulanamıyor.`
    );
    return config.trainAuthToken;
  }

  if (info.isExpired) {
    throw new Error(
      `TCDD_AUTH_TOKEN süresi dolmuş (${info.expiresAt.toISOString()}). ` +
      `Tarayıcıdan yeni token alıp GitHub Secrets içindeki TCDD_AUTH_TOKEN ` +
      `değerini güncelleyin.`
    );
  }

  console.log(
    `[${new Date().toISOString()}] Token geçerli, ` +
    `${info.daysRemaining} gün kaldı (${info.expiresAt.toISOString()})`
  );

  return config.trainAuthToken;
}
