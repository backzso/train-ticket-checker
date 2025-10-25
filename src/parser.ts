import { TCDDResponse } from './fetcher';

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

export function parseSeatAvailability(response: TCDDResponse, dateStr?: string): ParsedAvailability {
  const coaches: SeatAvailability[] = [];
  const departuresMap = new Map<string, {
    trainNumber: string;
    departureTime: string;
    coaches: SeatAvailability[];
  }>();
  
  // Bugünün tarihini al
  const today = new Date().toISOString().split('T')[0];
  const currentTime = new Date().toTimeString().slice(0, 5); // HH:MM format
  
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
        
        // Sadece bugün için geçmiş saatleri filtrele (gelecek tarihler için filtre yok)
        const today = new Date().toISOString().split('T')[0];
        let departureDate = today;
        
        if (train.segments && train.segments.length > 0 && train.segments[0].departureTime) {
          const timestamp = train.segments[0].departureTime;
          departureDate = new Date(timestamp).toISOString().split('T')[0];
        }
        
        // Sadece bugün için geçmiş saatleri filtrele
        if (departureDate === today && departureTime < currentTime) {
          continue; // Geçmiş saatleri atla
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
              // Sadece C, L, Y1 cabin class'larını dikkate al
              const validCabinClasses = ['C', 'L', 'Y1'];
              const hasValidCabinClass = car.availabilities.some(availability => 
                availability.cabinClass?.code && validCabinClasses.includes(availability.cabinClass.code)
              );
              
              if (hasValidCabinClass) {
                // Cabin class detaylarını topla
                const cabinClassDetails: Array<{code: string, name: string, seats: number}> = [];
                const validCabinClasses = ['C', 'L', 'Y1'];
                
                car.availabilities.forEach(availability => {
                  if (availability.cabinClass?.code && validCabinClasses.includes(availability.cabinClass.code) && availability.availability > 0) {
                    cabinClassDetails.push({
                      code: availability.cabinClass?.code || '',
                      name: availability.cabinClass?.name || '',
                      seats: availability.availability
                    });
                  }
                });
                
                const coachInfo = {
                  coachName: `Vagon ${car.name}`,
                  availableSeats: totalAvailability,
                  trainNumber: train.number,
                  departureTime: departureTime,
                  cabinClasses: cabinClassDetails
                };
                
                coaches.push(coachInfo);
                existingDeparture.coaches.push(coachInfo);
              }
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
              // Sadece C, L, Y1 cabin class'larını dikkate al
              const validCabinClasses = ['C', 'L', 'Y1'];
              const hasValidCabinClass = car.availabilities.some(availability => 
                availability.cabinClass?.code && validCabinClasses.includes(availability.cabinClass.code)
              );
              
              if (hasValidCabinClass) {
                // Cabin class detaylarını topla
                const cabinClassDetails: Array<{code: string, name: string, seats: number}> = [];
                const validCabinClasses = ['C', 'L', 'Y1'];
                
                car.availabilities.forEach(availability => {
                  if (availability.cabinClass?.code && validCabinClasses.includes(availability.cabinClass.code) && availability.availability > 0) {
                    cabinClassDetails.push({
                      code: availability.cabinClass?.code || '',
                      name: availability.cabinClass?.name || '',
                      seats: availability.availability
                    });
                  }
                });
                
                const coachInfo = {
                  coachName: `Vagon ${car.name}`,
                  availableSeats: totalAvailability,
                  trainNumber: train.number,
                  departureTime: departureTime,
                  cabinClasses: cabinClassDetails
                };
                
                coaches.push(coachInfo);
                trainCoaches.push(coachInfo);
              }
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

  return {
    trainNumber: response.trainLegs[0]?.trainAvailabilities[0]?.trains[0]?.number || 'Unknown',
    date: dateStr || new Date().toISOString().split('T')[0],
    route: response.trainLegs[0]?.trainAvailabilities[0]?.trains[0]?.name || 'Unknown',
    coaches,
    hasAvailableSeats: coaches.length > 0,
    departures
  };
}
