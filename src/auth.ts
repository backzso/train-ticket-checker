import { Config } from './config';

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

/**
 * TCDD Basic Authentication ile token alır
 */
export async function getTCDDAuthToken(): Promise<string> {
  console.log(`[${new Date().toISOString()}] Attempting to get TCDD auth token with Basic Auth...`);
  
  // TCDD'nin gerçek credentials'ları
  const username = 'ditravoyebsp';
  const password = 'ditra34!vo.';
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');
  
  // TCDD'nin muhtemel authentication endpoint'leri
  const authEndpoints = [
    'http://ytp-prod-master1.tcddtasimacilik.gov.tr:8080/realms/master/protocol/openid-connect/token',
    'https://ytp-prod-master1.tcddtasimacilik.gov.tr:8080/realms/master/protocol/openid-connect/token',
    'http://ytp-prod-master1.tcddtasimacilik.gov.tr:8080/auth/realms/master/protocol/openid-connect/token',
    'https://ytp-prod-master1.tcddtasimacilik.gov.tr:8080/auth/realms/master/protocol/openid-connect/token',
    'https://web-api-prod-ytp.tcddtasimacilik.gov.tr/auth/token',
    'https://web-api-prod-ytp.tcddtasimacilik.gov.tr/api/auth/token'
  ];

  for (const endpoint of authEndpoints) {
    try {
      console.log(`[${new Date().toISOString()}] Trying endpoint: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept-Language': 'TR',
          'Authorization': `Basic ${credentials}`
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: 'tms'
        })
      });

      if (response.ok) {
        const data = await response.json() as AuthResponse;
        console.log(`[${new Date().toISOString()}] Successfully got token from ${endpoint}`);
        return data.access_token;
      } else {
        console.log(`[${new Date().toISOString()}] Failed to get token from ${endpoint}: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.log(`[${new Date().toISOString()}] Error response: ${errorText}`);
      }
    } catch (error) {
      console.log(`[${new Date().toISOString()}] Error trying ${endpoint}:`, error);
    }
  }

  // Eğer otomatik token alma başarısız olursa, browser'dan almayı öner
  console.log(`[${new Date().toISOString()}] Automatic token retrieval failed. Please get token manually:`);
  console.log(`1. Go to https://ebilet.tcddtasimacilik.gov.tr`);
  console.log(`2. Open Developer Tools (F12)`);
  console.log(`3. Go to Network tab`);
  console.log(`4. Search for any train`);
  console.log(`5. Find 'train-availability' request`);
  console.log(`6. Copy the Authorization header value`);
  console.log(`7. Set TCDD_AUTH_TOKEN environment variable`);
  
  throw new Error('Could not get TCDD auth token automatically. Please get token from browser.');
}

/**
 * Token'ın süresini kontrol eder
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error checking token expiration:`, error);
    return true; // Hata durumunda token'ı expired kabul et
  }
}

/**
 * Token'ı otomatik olarak yeniler
 */
export async function refreshTokenIfNeeded(config: Config): Promise<string> {
  if (!config.tcddAuthToken || isTokenExpired(config.tcddAuthToken)) {
    console.log(`[${new Date().toISOString()}] Token expired or missing, attempting to refresh...`);
    
    try {
      return await getTCDDAuthToken();
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Failed to get new token automatically:`, error);
      console.log(`[${new Date().toISOString()}] Please get a fresh token from browser and set TCDD_AUTH_TOKEN environment variable`);
      throw new Error('Please get a fresh token from browser and set TCDD_AUTH_TOKEN environment variable');
    }
  }
  
  return config.tcddAuthToken;
}
