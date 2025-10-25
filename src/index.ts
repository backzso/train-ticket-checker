import { loadConfig, isWithinCheckHours, generateDateRange } from './config';
import { fetchSeatAvailabilityForDate, fetchSeatAvailabilityForMultipleDates } from './fetcher';
import { parseSeatAvailability } from './parser';
import { sendTelegramNotification } from './notifier';

async function main(): Promise<void> {
  console.log(`[${new Date().toISOString()}] TCDD Ticket Checker started`);
  
  try {
    const config = loadConfig();
    console.log(`[${new Date().toISOString()}] Configuration loaded successfully`);
    
    if (!isWithinCheckHours(config)) {
      const now = new Date().toTimeString().slice(0, 5);
      console.log(`[${new Date().toISOString()}] Current time ${now} is outside check hours (${config.checkStart} - ${config.checkEnd}). Exiting.`);
      return;
    }
    
    const datesToCheck = generateDateRange(config);
    console.log(`[${new Date().toISOString()}] Checking ${datesToCheck.length} dates: ${datesToCheck.join(', ')}`);
    
    let foundAnySeats = false;
    
    if (config.checkMultipleDates && datesToCheck.length > 1) {
      const results = await fetchSeatAvailabilityForMultipleDates(config, datesToCheck);
      
      for (const { date, response } of results) {
        const currentAvailability = parseSeatAvailability(response);
        currentAvailability.date = date;
        
        if (currentAvailability.coaches.length > 0) {
          console.log(`[${new Date().toISOString()}] Found ${currentAvailability.coaches.length} available coaches for date ${date}!`);
          await sendTelegramNotification(config, currentAvailability, currentAvailability.coaches);
          foundAnySeats = true;
        }
      }
    } else {
      const response = await fetchSeatAvailabilityForDate(config, datesToCheck[0]);
      const currentAvailability = parseSeatAvailability(response);
      
      if (currentAvailability.coaches.length > 0) {
        console.log(`[${new Date().toISOString()}] Found ${currentAvailability.coaches.length} available coaches!`);
        await sendTelegramNotification(config, currentAvailability, currentAvailability.coaches);
        foundAnySeats = true;
      }
    }
    
    if (!foundAnySeats) {
      console.log(`[${new Date().toISOString()}] No available seats found for any date`);
    }
    
    console.log(`[${new Date().toISOString()}] Check completed successfully`);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Application error:`, error);
    process.exit(1);
  }
}

async function runContinuous(): Promise<void> {
  const config = loadConfig();
  
  console.log(`[${new Date().toISOString()}] Starting continuous mode with ${config.pollIntervalMinutes} minute intervals`);
  console.log(`[${new Date().toISOString()}] Check hours: ${config.checkStart} - ${config.checkEnd}`);
  
  await main();
  
  const intervalMs = config.pollIntervalMinutes * 60 * 1000;
  setInterval(async () => {
    try {
      await main();
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in continuous mode:`, error);
    }
  }, intervalMs);
}

if (process.argv.includes('--continuous')) {
  runContinuous().catch(error => {
    console.error(`[${new Date().toISOString()}] Fatal error in continuous mode:`, error);
    process.exit(1);
  });
} else {
  main().catch(error => {
    console.error(`[${new Date().toISOString()}] Fatal error:`, error);
    process.exit(1);
  });
}