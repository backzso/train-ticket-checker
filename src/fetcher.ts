import axios from 'axios';
import { Config, formatDateForTCDD } from './config';
import { refreshTokenIfNeeded } from './auth';

export interface TCDDResponse {
  trainLegs: Array<{
    trainAvailabilities: Array<{
      trains: Array<{
        id: number;
        number: string;
        name: string;
        commercialName: string;
        type: string;
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

/**
 * Fetches seat availability data from TCDD API for a specific date
 */
export async function fetchSeatAvailabilityForDate(config: Config, dateStr: string): Promise<TCDDResponse> {
  console.log(`[${new Date().toISOString()}] Fetching seat availability for date: ${dateStr}`);
  
  try {
    // Token'ı otomatik olarak yenile
    const authToken = await refreshTokenIfNeeded(config);
    
    const formattedDate = formatDateForTCDD(dateStr);
    const requestBody = {
      searchRoutes: [{
        departureStationId: config.departureStationId,
        departureStationName: config.departureStationName,
        arrivalStationId: config.arrivalStationId,
        arrivalStationName: config.arrivalStationName,
        departureDate: formattedDate
      }],
      passengerTypeCounts: [{
        id: 0,
        count: 1
      }],
      searchReservation: false,
      blTrainTypes: ["TURISTIK_TREN"]
    };


    const response = await axios.post(config.tcddEndpoint, requestBody, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'tr',
        'Authorization': authToken,
        'Connection': 'keep-alive',
        'Content-Type': 'application/json',
        'Origin': 'https://ebilet.tcddtasimacilik.gov.tr',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'unit-id': config.unitId
      }
    });

    console.log(`[${new Date().toISOString()}] Successfully fetched data for date ${dateStr}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[${new Date().toISOString()}] Error fetching seat availability for date ${dateStr}:`, error.response?.status, error.response?.statusText);
      throw new Error(`HTTP ${error.response?.status}: ${error.response?.statusText}`);
    } else {
      console.error(`[${new Date().toISOString()}] Error fetching seat availability for date ${dateStr}:`, error);
      throw error;
    }
  }
}

/**
 * Fetches seat availability for multiple dates
 */
export async function fetchSeatAvailabilityForMultipleDates(config: Config, dates: string[]): Promise<Array<{date: string, response: TCDDResponse}>> {
  console.log(`[${new Date().toISOString()}] Fetching seat availability for ${dates.length} dates`);
  
  const results: Array<{date: string, response: TCDDResponse}> = [];
  
  for (const date of dates) {
    try {
      const response = await fetchSeatAvailabilityForDate(config, date);
      results.push({ date, response });
      
      // API rate limiting için kısa bekleme
      if (dates.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Failed to fetch data for date ${date}:`, error);
      // Bir tarih başarısız olsa bile diğerlerini denemeye devam et
    }
  }
  
  console.log(`[${new Date().toISOString()}] Successfully fetched data for ${results.length}/${dates.length} dates`);
  return results;
}

