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

export async function fetchSeatAvailabilityForDate(config: Config, dateStr: string): Promise<TCDDResponse> {
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
    passengerTypeCounts: [{ id: 0, count: 1 }],
    searchReservation: false,
    blTrainTypes: ["TURISTIK_TREN"]
  };

  const response = await axios.post(config.tcddEndpoint, requestBody, {
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'tr',
      'Authorization': authToken,
      'Content-Type': 'application/json',
      'Origin': 'https://ebilet.tcddtasimacilik.gov.tr',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      'unit-id': config.unitId
    }
  });

  return response.data;
}

export async function fetchSeatAvailabilityForMultipleDates(config: Config, dates: string[]): Promise<Array<{date: string, response: TCDDResponse}>> {
  const results: Array<{date: string, response: TCDDResponse}> = [];
  
  for (const date of dates) {
    try {
      const response = await fetchSeatAvailabilityForDate(config, date);
      results.push({ date, response });
      
      if (dates.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Failed to fetch data for date ${date}:`, error);
    }
  }
  
  return results;
}