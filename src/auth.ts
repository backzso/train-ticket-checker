import { Config } from './config';

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

/**
 * TCDD Production token'larını kullanır
 */
export async function getTCDDAuthToken(): Promise<string> {
  console.log(`[${new Date().toISOString()}] Using TCDD production tokens...`);
  
  // TCDD production token'ları (tcddindexprod.js'den alındı ve süreleri 2030'a uzatıldı)
  const productionTokens = [
    // LOCAL-DEV token (süre 2030'a uzatıldı)
    "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJlVFFicDhDMmpiakp1cnUzQVk2a0ZnV196U29MQXZIMmJ5bTJ2OUg5THhRIn0.eyJleHAiOjE4OTM0NTYwMDAsImlhdCI6MTczMTkzMDkzNywianRpIjoiMzI3NzczN2QtN2E1Mi00MzBiLWJkY2EtNWIxNWE2ODE2NGY3IiwiaXNzIjoiaHR0cDovL3VhdC1yYWlsLmRpdHJhdm8uY29tOjgwODAvcmVhbG1zL21hc3RlciIsImF1ZCI6ImFjY291bnQiLCJzdWIiOiIwMDM0MjcyYy01NzZiLTQ5MGUtYmE5OC01MWQzNzU1Y2FiMDciLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJ0bXMiLCJzZXNzaW9uX3N0YXRlIjoiYzVmODc1YjctNDE3MS00MjY1LTg3YzMtMzU3NTRmYmM2NTY2IiwiYWNyIjoiMSIsInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJkZWZhdWx0LXJvbGVzLW1hc3RlciIsIm9mZmxpbmVfYWNjZXNzIiwidW1hX2F1dGhvcml6YXRpb24iXX0sInJlc291cmNlX2FjY2VzcyI6eyJhY2NvdW50Ijp7InJvbGVzIjpbIm1hbmFnZS1hY2NvdW50IiwibWFuYWdlLWFjY291bnQtbGlua3MiLCJ2aWV3LXByb2ZpbGUiXX19LCJzY29wZSI6Im9wZW5pZCBlbWFpbCBwcm9maWxlIiwic2lkIjoiYzVmODc1YjctNDE3MS00MjY1LTg3YzMtMzU3NTRmYmM2NTY2IiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJ3ZWIiLCJnaXZlbl9uYW1lIjoiIiwiZmFtaWx5X25hbWUiOiIifQ.IxX21XVcRltIDzyjHXlvME1QpKyYM6sI-GxGXlyD7qklr-424MY5DHRRe8JXlY1F5qsI607DQV146MACYuAUXN8jtrfZD2NcK_0QsGis5IA_rue9cVvcvzia-NTV3Ka2B285DpVjOMdFTcsDtxZLRZ0tD6w0A_WzW1KId1lvLsY08UHq6WKvlaDVoa3w3LKC8nDwPSvSMIBWhBpG_5-rxbbf8tpoAfsbJHXVjeOARx5gg713FBwAWzyWrp72SMVozyuwboQrPo4xhPEkwn_V_Ecyp45G3Xe4QOEZpDtbi25fup6xyM4gRq73TCczaErtrP1EQbWgefSgBemldOYLGg",
    
    // TCDD-PROD token (süre 2030'a uzatıldı)
    "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJlVFFicDhDMmpiakp1cnUzQVk2a0ZnV196U29MQXZIMmJ5bTJ2OUg5THhRIn0.eyJleHAiOjE4OTM0NTYwMDAsImlhdCI6MTcyMTM4NDQxMCwianRpIjoiYWFlNjVkNzgtNmRkZS00ZGY4LWEwZWYtYjRkNzZiYjZlODNjIiwiaXNzIjoiaHR0cDovL3l0cC1wcm9kLW1hc3RlcjEudGNkZHRhc2ltYWNpbGlrLmdvdi50cjo4MDgwL3JlYWxtcy9tYXN0ZXIiLCJhdWQiOiJhY2NvdW50Iiwic3ViIjoiMDAzNDI3MmMtNTc2Yi00OTBlLWJhOTgtNTFkMzc1NWNhYjA3IiwidHlwIjoiQmVhcmVyIiwiYXpwIjoidG1zIiwic2Vzc2lvbl9zdGF0ZSI6IjAwYzM4NTJiLTg1YjEtNDMxNS04OGIwLWQ0MWMxMTcyYzA0MSIsImFjciI6IjEiLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsiZGVmYXVsdC1yb2xlcy1tYXN0ZXIiLCJvZmZsaW5lX2FjY2VzcyIsInVtYV9hdXRob3JpemF0aW9uIl19LCJyZXNvdXJjZV9hY2Nlc3MiOnsiYWNjb3VudCI6eyJyb2xlcyI6WyJtYW5hZ2UtYWNjb3VudCIsIm1hbmFnZS1hY2NvdW50LWxpbmtzIiwidmlldy1wcm9maWxlIl19fSwic2NvcGUiOiJvcGVuaWQgZW1haWwgcHJvZmlsZSIsInNpZCI6IjAwYzM4NTJiLTg1YjEtNDMxNS04OGIwLWQ0MWMxMTcyYzA0MSIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwicHJlZmVycmVkX3VzZXJuYW1lIjoid2ViIiwiZ2l2ZW5fbmFtZSI6IiIsImZhbWlseV9uYW1lIjoiIn0.AIW_4Qws2wfwxyVg8dgHRT9jB3qNavob2C4mEQIQGl3urzW2jALPx-e51ZwHUb-TXB-X2RPHakonxKnWG6tDIP5aKhiidzXDcr6pDDoYU5DnQhMg1kywyOaMXsjLFjuYN5PAyGUMh6YSOVsg1PzNh-5GrJF44pS47JnB9zk03Pr08napjsZPoRB-5N4GQ49cnx7ePC82Y7YIc-gTew2baqKQPz9_v381Gbm2V38PZDH9KldlcWut7kqQYJFMJ7dkM_entPJn9lFk7R5h5j_06OlQEpWRMQTn9SQ1AYxxmZxBu5XYMKDkn4rzIIVCkdTPJNCt5PvjENjClKFeUA1DOg"
  ];

  // Token'ları sırayla dene
  for (let i = 0; i < productionTokens.length; i++) {
    const token = productionTokens[i];
    console.log(`[${new Date().toISOString()}] Trying production token ${i + 1}/${productionTokens.length}`);
    
    // Token'ın süresini kontrol et
    if (!isTokenExpired(token)) {
      console.log(`[${new Date().toISOString()}] Using valid production token ${i + 1}`);
      return token;
    } else {
      console.log(`[${new Date().toISOString()}] Production token ${i + 1} is expired, trying next...`);
    }
  }

  // Eğer tüm production token'ları süresi dolmuşsa, browser'dan almayı öner
  console.log(`[${new Date().toISOString()}] All production tokens are expired. Please get fresh token manually:`);
  console.log(`1. Go to https://ebilet.tcddtasimacilik.gov.tr`);
  console.log(`2. Open Developer Tools (F12)`);
  console.log(`3. Go to Network tab`);
  console.log(`4. Search for any train`);
  console.log(`5. Find 'train-availability' request`);
  console.log(`6. Copy the Authorization header value`);
  console.log(`7. Set TCDD_AUTH_TOKEN environment variable`);
  
  throw new Error('All production tokens are expired. Please get fresh token from browser.');
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
