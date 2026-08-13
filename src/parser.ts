import { TCDDResponse } from './fetcher';
import { localDate, localTime } from './config';

/** Bildirimlerde gösterilecek kabin sınıfları. */
const VALID_CABIN_CLASSES = ['C', 'L', 'Y1'];

export interface SeatAvailability {
  coachName: string;
  availableSeats: number;
  trainNumber: string;
  departureTime: string;
  cabinClasses: Array<{
    code: string;
    name: string;
    seats: number;
  }>;
}

export interface Departure {
  trainNumber: string;
  departureTime: string;
  coaches: SeatAvailability[];
}

export interface ParsedAvailability {
  trainNumber: string;
  date: string;
  route: string;
  coaches: SeatAvailability[];
  hasAvailableSeats: boolean;
  departures: Departure[];
}

type TrainCar = TCDDResponse['trainLegs'][number]['trainAvailabilities'][number]['trains'][number]['cars'][number];

/**
 * Bir vagonu, geçerli kabin sınıflarında boş koltuğu varsa
 * bildirime uygun biçime dönüştürür. Uygun değilse null döner.
 */
function parseCar(car: TrainCar, trainNumber: string, departureTime: string): SeatAvailability | null {
  const cabinClasses = car.availabilities
    .filter(a => a.cabinClass?.code && VALID_CABIN_CLASSES.includes(a.cabinClass.code) && a.availability > 0)
    .map(a => ({
      code: a.cabinClass.code,
      name: a.cabinClass.name,
      seats: a.availability
    }));

  if (cabinClasses.length === 0) return null;

  return {
    coachName: `Vagon ${car.name}`,
    availableSeats: cabinClasses.reduce((sum, c) => sum + c.seats, 0),
    trainNumber,
    departureTime,
    cabinClasses
  };
}

export function parseSeatAvailability(response: TCDDResponse, dateStr?: string): ParsedAvailability {
  const coaches: SeatAvailability[] = [];
  const departuresMap = new Map<string, Departure>();

  const today = localDate();
  const currentTime = localTime();

  for (const trainLeg of response.trainLegs ?? []) {
    for (const trainAvailability of trainLeg.trainAvailabilities ?? []) {
      for (const train of trainAvailability.trains ?? []) {
        const timestamp = train.segments?.[0]?.departureTime;

        // Kalkış zamanı bilinmiyorsa tren atlanır — geçmiş sefer filtresi
        // uydurma bir saate göre çalışmasın.
        if (!timestamp) continue;

        const departureDateTime = new Date(timestamp);
        const departureTime = localTime(departureDateTime);
        const departureDate = localDate(departureDateTime);

        // Sadece bugünün geçmiş seferlerini ele; gelecek tarihler dokunulmaz.
        if (departureDate === today && departureTime < currentTime) {
          continue;
        }

        const trainKey = `${train.number}-${departureTime}`;
        let departure = departuresMap.get(trainKey);

        if (!departure) {
          departure = { trainNumber: train.number, departureTime, coaches: [] };
          departuresMap.set(trainKey, departure);
        }

        for (const car of train.cars ?? []) {
          const coach = parseCar(car, train.number, departureTime);
          if (coach) {
            coaches.push(coach);
            departure.coaches.push(coach);
          }
        }
      }
    }
  }

  // Boş koltuğu olmayan seferleri çıkar.
  const departures = Array.from(departuresMap.values()).filter(d => d.coaches.length > 0);

  // Seferleri kalkış saatine göre sırala.
  departures.sort((a, b) => a.departureTime.localeCompare(b.departureTime));

  const firstTrain = response.trainLegs?.[0]?.trainAvailabilities?.[0]?.trains?.[0];

  return {
    trainNumber: firstTrain?.number || 'Unknown',
    date: dateStr || today,
    route: firstTrain?.name || 'Unknown',
    coaches,
    hasAvailableSeats: coaches.length > 0,
    departures
  };
}
