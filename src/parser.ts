import { TCDDResponse } from './fetcher';

export interface SeatAvailability {
  coachName: string;
  availableSeats: number;
}

export interface ParsedAvailability {
  trainNumber: string;
  date: string;
  route: string;
  coaches: SeatAvailability[];
  hasAvailableSeats: boolean;
}

export function parseSeatAvailability(response: TCDDResponse): ParsedAvailability {
  const coaches: SeatAvailability[] = [];
  
  for (const trainLeg of response.trainLegs) {
    for (const trainAvailability of trainLeg.trainAvailabilities) {
      for (const train of trainAvailability.trains) {
        for (const car of train.cars) {
          const totalAvailability = car.availabilities.reduce((sum, availability) => {
            return sum + availability.availability;
          }, 0);
          
          if (totalAvailability > 0) {
            coaches.push({
              coachName: `Vagon ${car.name}`,
              availableSeats: totalAvailability
            });
          }
        }
      }
    }
  }

  return {
    trainNumber: response.trainLegs[0]?.trainAvailabilities[0]?.trains[0]?.number || 'Unknown',
    date: new Date().toISOString().split('T')[0],
    route: response.trainLegs[0]?.trainAvailabilities[0]?.trains[0]?.name || 'Unknown',
    coaches,
    hasAvailableSeats: coaches.length > 0
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