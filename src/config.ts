import dotenv from 'dotenv';

// Load environment variables
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
  // Yeni esneklik seçenekleri
  dateRangeStart?: string; // YYYY-MM-DD formatında başlangıç tarihi
  dateRangeEnd?: string;   // YYYY-MM-DD formatında bitiş tarihi
  checkMultipleDates: boolean; // Birden fazla tarih kontrol et
  maxDaysToCheck: number; // Maksimum kaç gün ileriye bakılacak
}

/**
 * Loads and validates configuration from environment variables
 */
export function loadConfig(): Config {
  const requiredVars = [
    'TCDD_ENDPOINT',
    'DEPARTURE_STATION_ID',
    'DEPARTURE_STATION_NAME',
    'ARRIVAL_STATION_ID',
    'ARRIVAL_STATION_NAME',
    'DEPARTURE_DATE',
    'CHECK_START',
    'CHECK_END',
    'POLL_INTERVAL_MINUTES',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID',
    'TCDD_AUTH_TOKEN',
    'UNIT_ID'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  const pollInterval = parseInt(process.env.POLL_INTERVAL_MINUTES!, 10);
  if (isNaN(pollInterval) || pollInterval < 1) {
    throw new Error('POLL_INTERVAL_MINUTES must be a positive number');
  }

  // Yeni esneklik seçenekleri için varsayılan değerler
  const checkMultipleDates = process.env.CHECK_MULTIPLE_DATES === 'true';
  const maxDaysToCheck = parseInt(process.env.MAX_DAYS_TO_CHECK || '7', 10);

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
    // Yeni esneklik seçenekleri
    dateRangeStart: process.env.DATE_RANGE_START,
    dateRangeEnd: process.env.DATE_RANGE_END,
    checkMultipleDates,
    maxDaysToCheck
  };
}

/**
 * Checks if current time is within the allowed checking hours
 */
export function isWithinCheckHours(config: Config): boolean {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  
  return currentTime >= config.checkStart && currentTime <= config.checkEnd;
}

/**
 * Generates date range for checking multiple dates
 */
export function generateDateRange(config: Config): string[] {
  const dates: string[] = [];
  
  if (!config.checkMultipleDates) {
    // Tek tarih modu - sadece belirtilen tarihi kullan
    dates.push(config.departureDate);
    return dates;
  }
  
  // Tarih aralığı modu
  let startDate: Date;
  let endDate: Date;
  
  if (config.dateRangeStart && config.dateRangeEnd) {
    // Belirtilen tarih aralığı
    startDate = new Date(config.dateRangeStart);
    endDate = new Date(config.dateRangeEnd);
  } else {
    // Bugünden itibaren belirtilen gün sayısı kadar
    startDate = new Date();
    endDate = new Date();
    endDate.setDate(startDate.getDate() + config.maxDaysToCheck);
  }
  
  // Tarih aralığındaki her günü ekle
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    dates.push(dateStr);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  console.log(`[${new Date().toISOString()}] Generated ${dates.length} dates to check: ${dates.join(', ')}`);
  return dates;
}

/**
 * Converts date from YYYY-MM-DD to DD-MM-YYYY HH:MM:SS format for TCDD API
 */
export function formatDateForTCDD(dateStr: string, timeStr: string = '21:00:00'): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}-${month}-${year} ${timeStr}`;
}
