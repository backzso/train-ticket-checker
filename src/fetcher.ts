import axios from 'axios';
import { Config, formatDateForTCDD } from './config';
import { resolveAuthToken } from './auth';

export interface TCDDResponse {
  trainLegs: Array<{
    trainAvailabilities: Array<{
      trains: Array<{
        id: number;
        number: string;
        name: string;
        commercialName: string;
        type: string;
        segments?: Array<{
          id: number;
          departureTime: number;
        }>;
        cars: Array<{
          id: number;
          name: string;
          trainId: number;
          capacity: number;
          availabilities: Array<{
            trainCarId: number;
            trainCarName: string | null;
            cabinClass: {
              id: number;
              code: string;
              name: string;
            };
            availability: number;
          }>;
        }>;
      }>;
    }>;
  }>;
}

export async function fetchSeatAvailabilityForDate(config: Config, dateStr: string): Promise<TCDDResponse> {
  const authToken = resolveAuthToken(config);
  const formattedDate = formatDateForTCDD(dateStr);

  const requestBody = {
    searchRoutes: [{
      departureStationId: config.departureStationId,
      departureStationName: config.departureStationName,
      arrivalStationId: config.arrivalStationId,
      arrivalStationName: config.arrivalStationName,
      departureDate: formattedDate
    }],
    passengerTypeCounts: [{ id: 0, count: 1 }],
    searchReservation: false,
    blTrainTypes: ["TURISTIK_TREN"]
  };

  try {
    // TCDD'nin nginx katmanı, isteğin gerçek tarayıcıdan geldiğini bu başlık
    // setiyle doğruluyor. Eksik olursa (örn. varsayılan curl/axios UA'sı) API'ye
    // ulaşmadan 403 döner — bu yüzden tam tarayıcı başlık seti gönderilir.
    const response = await axios.post(config.trainEndpoint, requestBody, {
      timeout: 30000,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'tr',
        'Authorization': authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Origin': 'https://ebilet.tcddtasimacilik.gov.tr',
        'Referer': 'https://ebilet.tcddtasimacilik.gov.tr/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Chromium";v="141", "Google Chrome";v="141", "Not?A_Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'unit-id': config.unitId
      }
    });

    if (!response.data?.trainLegs) {
      throw new Error(
        `TCDD API beklenmeyen yanıt döndürdü (trainLegs yok): ` +
        `${JSON.stringify(response.data).slice(0, 200)}`
      );
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 403) {
        throw new Error(
          `TCDD API isteği reddedildi (403). nginx katmanı isteği eledi — ` +
          `büyük olasılıkla fetcher.ts'deki tarayıcı başlıkları veya gömülü ` +
          `token güncel değil. Ayrıntı için TOKEN.md'ye bakın.`
        );
      }
      if (status === 401) {
        throw new Error(
          `TCDD API kimlik doğrulama hatası (401). Sağlanan TCDD_AUTH_TOKEN ` +
          `geçersiz olabilir; secret'ı silip gömülü token'ı kullanmayı deneyin.`
        );
      }
      throw new Error(
        `TCDD API isteği başarısız (${status ?? error.code}): ${error.message}`
      );
    }
    throw error;
  }
}

export interface DateFetchResult {
  date: string;
  response: TCDDResponse;
}

export interface MultiDateFetchResult {
  results: DateFetchResult[];
  failures: Array<{ date: string; error: Error }>;
}

/**
 * Birden fazla tarih için sorgu yapar.
 *
 * Tek tek hatalar tüm çalıştırmayı durdurmaz, ancak sessizce yutulmaz da —
 * çağıran taraf `failures` üzerinden hataları görüp karar verir.
 */
export async function fetchSeatAvailabilityForMultipleDates(
  config: Config,
  dates: string[]
): Promise<MultiDateFetchResult> {
  const results: DateFetchResult[] = [];
  const failures: Array<{ date: string; error: Error }> = [];

  for (const [index, date] of dates.entries()) {
    try {
      const response = await fetchSeatAvailabilityForDate(config, date);
      results.push({ date, response });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[${new Date().toISOString()}] ${date} tarihi için sorgu başarısız: ${err.message}`);
      failures.push({ date, error: err });
    }

    // TCDD arka arkaya gelen isteklere rate-limit uyguluyor; tarihler arasında
    // bekleyerek 403 almayı önle.
    if (index < dates.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  return { results, failures };
}