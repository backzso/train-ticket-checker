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

/**
 * Parses TCDD API response and extracts seat availability information
 */
export function parseSeatAvailability(response: TCDDResponse): ParsedAvailability {
  const coaches: SeatAvailability[] = [];
  
  
  // Extract coaches and their availability from the complex TCDD response structure
  for (const trainLeg of response.trainLegs) {
    for (const trainAvailability of trainLeg.trainAvailabilities) {
      for (const train of trainAvailability.trains) {
        console.log(`[${new Date().toISOString()}] Processing train ${train.number} (${train.name})`);
        
        for (const car of train.cars) {
          // Sum up availability across all cabin classes for this car
          const totalAvailability = car.availabilities.reduce((sum, availability) => {
            return sum + availability.availability;
          }, 0);
          
          if (totalAvailability > 0) {
            coaches.push({
              coachName: `Vagon ${car.name}`,
              availableSeats: totalAvailability
            });
          }
          
          // Log detailed availability by cabin class
          car.availabilities.forEach(availability => {
            if (availability.availability > 0) {
              const cabinClassName = availability.cabinClass?.name || 'UNKNOWN';
              console.log(`  Vagon ${car.name} - ${cabinClassName}: ${availability.availability} koltuk`);
            }
          });
        }
      }
    }
  }

  const hasAvailableSeats = coaches.length > 0;
  const route = `${response.trainLegs[0]?.trainAvailabilities[0]?.trains[0]?.name || 'Unknown'}`;

  console.log(`[${new Date().toISOString()}] Parsed availability summary:`);
  coaches.forEach(coach => {
    console.log(`  ${coach.coachName}: ${coach.availableSeats} seats available`);
  });

  return {
    trainNumber: response.trainLegs[0]?.trainAvailabilities[0]?.trains[0]?.number || 'Unknown',
    date: new Date().toISOString().split('T')[0], // Use current date as fallback
    route,
    coaches,
    hasAvailableSeats
  };
}

/**
 * Finds coaches with newly available seats compared to previous state
 */
export function findNewlyAvailableSeats(
  current: ParsedAvailability,
  previous: ParsedAvailability | null
): SeatAvailability[] {
  if (!previous) {
    // If no previous state, return all coaches with available seats
    return current.coaches.filter(coach => coach.availableSeats > 0);
  }

  const newlyAvailable: SeatAvailability[] = [];

  for (const currentCoach of current.coaches) {
    const previousCoach = previous.coaches.find(
      coach => coach.coachName === currentCoach.coachName
    );

    // If coach wasn't in previous state or had 0 seats, and now has seats
    if ((!previousCoach || previousCoach.availableSeats === 0) && currentCoach.availableSeats > 0) {
      newlyAvailable.push(currentCoach);
    }
  }

  return newlyAvailable;
}
