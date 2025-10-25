import { TCDDResponse } from './fetcher';

export interface SeatAvailability {
  coachName: string;
  availableSeats: number;
  trainNumber: string;
  departureTime: string;
}

export interface ParsedAvailability {
  trainNumber: string;
  date: string;
  route: string;
  coaches: SeatAvailability[];
  hasAvailableSeats: boolean;
  departures: Array<{
    trainNumber: string;
    departureTime: string;
    coaches: SeatAvailability[];
  }>;
}

export function parseSeatAvailability(response: TCDDResponse): ParsedAvailability {
  const coaches: SeatAvailability[] = [];
  const departuresMap = new Map<string, {
    trainNumber: string;
    departureTime: string;
    coaches: SeatAvailability[];
  }>();
  
  for (const trainLeg of response.trainLegs) {
    for (const trainAvailability of trainLeg.trainAvailabilities) {
      for (const train of trainAvailability.trains) {
        // Departure time'ı timestamp'ten parse et
        let departureTime = '21:00';
        if (train.segments && train.segments.length > 0 && train.segments[0].departureTime) {
          const timestamp = train.segments[0].departureTime;
          const date = new Date(timestamp);
          departureTime = date.toTimeString().slice(0, 5); // HH:MM format
        }
        
        // Tren için unique key oluştur (trainNumber + departureTime)
        const trainKey = `${train.number}-${departureTime}`;
        
        // Eğer bu tren zaten departuresMap'te varsa, vagonları ekle
        if (departuresMap.has(trainKey)) {
          const existingDeparture = departuresMap.get(trainKey)!;
          
          for (const car of train.cars) {
            const totalAvailability = car.availabilities.reduce((sum, availability) => {
              return sum + availability.availability;
            }, 0);
            
            if (totalAvailability > 0) {
              const coachInfo = {
                coachName: `Vagon ${car.name}`,
                availableSeats: totalAvailability,
                trainNumber: train.number,
                departureTime: departureTime
              };
              
              coaches.push(coachInfo);
              existingDeparture.coaches.push(coachInfo);
            }
          }
        } else {
          // Yeni tren, yeni departure oluştur
          const trainCoaches: SeatAvailability[] = [];
          
          for (const car of train.cars) {
            const totalAvailability = car.availabilities.reduce((sum, availability) => {
              return sum + availability.availability;
            }, 0);
            
            if (totalAvailability > 0) {
              const coachInfo = {
                coachName: `Vagon ${car.name}`,
                availableSeats: totalAvailability,
                trainNumber: train.number,
                departureTime: departureTime
              };
              
              coaches.push(coachInfo);
              trainCoaches.push(coachInfo);
            }
          }
          
          if (trainCoaches.length > 0) {
            departuresMap.set(trainKey, {
              trainNumber: train.number,
              departureTime: departureTime,
              coaches: trainCoaches
            });
          }
        }
      }
    }
  }
  
  // Map'i array'e çevir
  const departures = Array.from(departuresMap.values());
  
  console.log(`[${new Date().toISOString()}] Parsed ${departures.length} unique departures:`, departures.map(d => `${d.trainNumber}-${d.departureTime}`));

  return {
    trainNumber: response.trainLegs[0]?.trainAvailabilities[0]?.trains[0]?.number || 'Unknown',
    date: new Date().toISOString().split('T')[0],
    route: response.trainLegs[0]?.trainAvailabilities[0]?.trains[0]?.name || 'Unknown',
    coaches,
    hasAvailableSeats: coaches.length > 0,
    departures
  };
}

export function findNewlyAvailableSeats(
  current: ParsedAvailability,
  previous: ParsedAvailability | null
): SeatAvailability[] {
  if (!previous) {
    return current.coaches.filter(coach => coach.availableSeats > 0);
  }

  const newlyAvailable: SeatAvailability[] = [];

  for (const currentCoach of current.coaches) {
    const previousCoach = previous.coaches.find(
      coach => coach.coachName === currentCoach.coachName
    );

    if ((!previousCoach || previousCoach.availableSeats === 0) && currentCoach.availableSeats > 0) {
      newlyAvailable.push(currentCoach);
    }
  }

  return newlyAvailable;
}