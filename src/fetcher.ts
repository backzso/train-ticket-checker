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


    const response = await fetch(config.tcddEndpoint, {
      method: 'POST',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'tr',
        'authorization': authToken,
        'content-type': 'application/json',
        'sec-ch-ua': '"Brave";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'sec-gpc': '1',
        'unit-id': config.unitId
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as TCDDResponse;
    console.log(`[${new Date().toISOString()}] Successfully fetched data for date ${dateStr}`);
    
    return data;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error fetching seat availability for date ${dateStr}:`, error);
    throw error;
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

