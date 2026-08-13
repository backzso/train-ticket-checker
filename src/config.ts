import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  trainEndpoint: string;
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
  trainAuthToken: string;
  unitId: string;
  checkMultipleDates: boolean;
  maxDaysToCheck: number;
}

/**
 * Bir ortam değişkenini okur. Eski `TRAIN_*` adlarını da kabul eder,
 * böylece eski .env dosyaları çalışmaya devam eder.
 */
function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value) return value;

  const legacyName = name.replace(/^TCDD_/, 'TRAIN_');
  return legacyName !== name ? process.env[legacyName] : undefined;
}

export function loadConfig(): Config {
  const requiredVars = [
    'TCDD_ENDPOINT', 'DEPARTURE_STATION_ID', 'DEPARTURE_STATION_NAME',
    'ARRIVAL_STATION_ID', 'ARRIVAL_STATION_NAME', 'DEPARTURE_DATE',
    'CHECK_START', 'CHECK_END', 'POLL_INTERVAL_MINUTES',
    'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'TCDD_AUTH_TOKEN', 'UNIT_ID'
  ];

  const missingVars = requiredVars.filter(varName => !readEnv(varName));
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  const pollInterval = parseInt(readEnv('POLL_INTERVAL_MINUTES')!, 10);
  if (isNaN(pollInterval) || pollInterval < 1) {
    throw new Error('POLL_INTERVAL_MINUTES must be a positive number');
  }

  const departureStationId = parseInt(readEnv('DEPARTURE_STATION_ID')!, 10);
  const arrivalStationId = parseInt(readEnv('ARRIVAL_STATION_ID')!, 10);
  if (isNaN(departureStationId) || isNaN(arrivalStationId)) {
    throw new Error('DEPARTURE_STATION_ID and ARRIVAL_STATION_ID must be numbers');
  }

  const maxDaysToCheck = parseInt(readEnv('MAX_DAYS_TO_CHECK') || '7', 10);
  if (isNaN(maxDaysToCheck) || maxDaysToCheck < 1) {
    throw new Error('MAX_DAYS_TO_CHECK must be a positive number');
  }

  return {
    trainEndpoint: readEnv('TCDD_ENDPOINT')!,
    departureStationId,
    departureStationName: readEnv('DEPARTURE_STATION_NAME')!,
    arrivalStationId,
    arrivalStationName: readEnv('ARRIVAL_STATION_NAME')!,
    departureDate: readEnv('DEPARTURE_DATE')!,
    checkStart: readEnv('CHECK_START')!,
    checkEnd: readEnv('CHECK_END')!,
    pollIntervalMinutes: pollInterval,
    telegramBotToken: readEnv('TELEGRAM_BOT_TOKEN')!,
    telegramChatId: readEnv('TELEGRAM_CHAT_ID')!,
    trainAuthToken: readEnv('TCDD_AUTH_TOKEN')!,
    unitId: readEnv('UNIT_ID')!,
    checkMultipleDates: readEnv('CHECK_MULTIPLE_DATES') === 'true',
    maxDaysToCheck
  };
}

/**
 * Bildirimlerin gönderilip gönderilmeyeceğini belirler.
 * Varsayılan AÇIK — sadece açıkça 'false' verilirse kapanır.
 */
export function shouldSendNotifications(): boolean {
  return (process.env.SEND_NOTIFICATIONS || '').toLowerCase() !== 'false';
}

/** Tüm tarih/saat işlemleri bu saat dilimine göre yapılır. */
export const TIMEZONE = process.env.TZ || 'Europe/Istanbul';

/** Verilen anın Türkiye saatiyle HH:MM karşılığı. */
export function localTime(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/** Verilen anın Türkiye saatiyle YYYY-MM-DD karşılığı. */
export function localDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

export function isWithinCheckHours(config: Config): boolean {
  const currentTime = localTime();
  return currentTime >= config.checkStart && currentTime <= config.checkEnd;
}

export function generateDateRange(config: Config): string[] {
  if (!config.checkMultipleDates) {
    return [config.departureDate];
  }

  const dates: string[] = [];
  const startDate = new Date();

  for (let i = 0; i < config.maxDaysToCheck; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(localDate(date));
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