import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  tcddEndpoint: string;
  departureStationId: number;
  departureStationName: string;
  arrivalStationId: number;
  arrivalStationName: string;
  departureDate: string;
  checkStart: string;
  checkEnd: string;
  pollIntervalMinutes: number;
  telegramBotToken: string;
  telegramChatId: string;
  tcddAuthToken: string;
  unitId: string;
  checkMultipleDates: boolean;
  maxDaysToCheck: number;
}

export function loadConfig(): Config {
  const requiredVars = [
    'TCDD_ENDPOINT', 'DEPARTURE_STATION_ID', 'DEPARTURE_STATION_NAME',
    'ARRIVAL_STATION_ID', 'ARRIVAL_STATION_NAME', 'DEPARTURE_DATE',
    'CHECK_START', 'CHECK_END', 'POLL_INTERVAL_MINUTES',
    'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'TCDD_AUTH_TOKEN', 'UNIT_ID'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  const pollInterval = parseInt(process.env.POLL_INTERVAL_MINUTES!, 10);
  if (isNaN(pollInterval) || pollInterval < 1) {
    throw new Error('POLL_INTERVAL_MINUTES must be a positive number');
  }

  return {
    tcddEndpoint: process.env.TCDD_ENDPOINT!,
    departureStationId: parseInt(process.env.DEPARTURE_STATION_ID!, 10),
    departureStationName: process.env.DEPARTURE_STATION_NAME!,
    arrivalStationId: parseInt(process.env.ARRIVAL_STATION_ID!, 10),
    arrivalStationName: process.env.ARRIVAL_STATION_NAME!,
    departureDate: process.env.DEPARTURE_DATE!,
    checkStart: process.env.CHECK_START!,
    checkEnd: process.env.CHECK_END!,
    pollIntervalMinutes: pollInterval,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN!,
    telegramChatId: process.env.TELEGRAM_CHAT_ID!,
    tcddAuthToken: process.env.TCDD_AUTH_TOKEN!,
    unitId: process.env.UNIT_ID!,
    checkMultipleDates: process.env.CHECK_MULTIPLE_DATES === 'true',
    maxDaysToCheck: parseInt(process.env.MAX_DAYS_TO_CHECK || '7', 10)
  };
}

export function isWithinCheckHours(config: Config): boolean {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  return currentTime >= config.checkStart && currentTime <= config.checkEnd;
}

export function generateDateRange(config: Config): string[] {
  if (!config.checkMultipleDates) {
    return [config.departureDate];
  }
  
  const dates: string[] = [];
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + config.maxDaysToCheck);
  
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dates.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
}

export function formatDateForTCDD(dateStr: string, timeStr: string = '21:00:00'): string {
  // Eğer zaten dd-MM-yyyy formatındaysa, olduğu gibi döndür
  if (dateStr.includes('-') && dateStr.split('-')[0].length === 2) {
    return `${dateStr} ${timeStr}`;
  }
  
  // Eğer yyyy-MM-dd formatındaysa, dd-MM-yyyy'ye çevir
  const [year, month, day] = dateStr.split('-');
  return `${day}-${month}-${year} ${timeStr}`;
}