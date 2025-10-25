import { loadConfig, isWithinCheckHours, generateDateRange } from './config';
import { fetchSeatAvailabilityForDate, fetchSeatAvailabilityForMultipleDates } from './fetcher';
import { parseSeatAvailability, findNewlyAvailableSeats } from './parser';
import { loadState, saveState } from './state';
import { sendTelegramNotification } from './notifier';

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  console.log(`[${new Date().toISOString()}] TCDD Ticket Checker started`);
  
  try {
    // Load configuration
    const config = loadConfig();
    console.log(`[${new Date().toISOString()}] Configuration loaded successfully`);
    
    // Check if we're within allowed checking hours
    if (!isWithinCheckHours(config)) {
      const now = new Date().toTimeString().slice(0, 5);
      console.log(`[${new Date().toISOString()}] Current time ${now} is outside check hours (${config.checkStart} - ${config.checkEnd}). Exiting.`);
      return;
    }
    
    // Load previous state
    const state = await loadState();
    
    // Generate dates to check
    const datesToCheck = generateDateRange(config);
    console.log(`[${new Date().toISOString()}] Checking ${datesToCheck.length} dates: ${datesToCheck.join(', ')}`);
    
    let foundAnySeats = false;
    
    if (config.checkMultipleDates && datesToCheck.length > 1) {
      // Birden fazla tarih kontrol et
      const results = await fetchSeatAvailabilityForMultipleDates(config, datesToCheck);
      
      for (const { date, response } of results) {
        const currentAvailability = parseSeatAvailability(response);
        currentAvailability.date = date; // Tarihi güncelle
        
        // Check for newly available seats
        const newlyAvailableSeats = findNewlyAvailableSeats(currentAvailability, state.lastAvailability);
        
        if (newlyAvailableSeats.length > 0) {
          console.log(`[${new Date().toISOString()}] Found ${newlyAvailableSeats.length} newly available coaches for date ${date}!`);
          
          // Send Telegram notification
          await sendTelegramNotification(config, currentAvailability, newlyAvailableSeats);
          foundAnySeats = true;
        }
      }
    } else {
      // Tek tarih kontrol et (eski davranış)
      const response = await fetchSeatAvailabilityForDate(config, datesToCheck[0]);
      const currentAvailability = parseSeatAvailability(response);
      
      // Check for newly available seats
      const newlyAvailableSeats = findNewlyAvailableSeats(currentAvailability, state.lastAvailability);
      
      if (newlyAvailableSeats.length > 0) {
        console.log(`[${new Date().toISOString()}] Found ${newlyAvailableSeats.length} newly available coaches!`);
        
        // Send Telegram notification
        await sendTelegramNotification(config, currentAvailability, newlyAvailableSeats);
        foundAnySeats = true;
      }
      
      // Save current state (sadece tek tarih modunda)
      await saveState(currentAvailability);
    }
    
    if (!foundAnySeats) {
      console.log(`[${new Date().toISOString()}] No newly available seats found for any date`);
    }
    
    console.log(`[${new Date().toISOString()}] Check completed successfully`);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Application error:`, error);
    process.exit(1);
  }
}

/**
 * Runs the application in continuous mode (for local development)
 */
async function runContinuous(): Promise<void> {
  const config = loadConfig();
  
  console.log(`[${new Date().toISOString()}] Starting continuous mode with ${config.pollIntervalMinutes} minute intervals`);
  console.log(`[${new Date().toISOString()}] Check hours: ${config.checkStart} - ${config.checkEnd}`);
  
  // Run immediately
  await main();
  
  // Set up interval
  const intervalMs = config.pollIntervalMinutes * 60 * 1000;
  setInterval(async () => {
    try {
      await main();
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in continuous mode:`, error);
    }
  }, intervalMs);
}

// Check if running in continuous mode (for local development)
if (process.argv.includes('--continuous')) {
  runContinuous().catch(error => {
    console.error(`[${new Date().toISOString()}] Fatal error in continuous mode:`, error);
    process.exit(1);
  });
} else {
  // Single run mode (for GitHub Actions)
  main().catch(error => {
    console.error(`[${new Date().toISOString()}] Fatal error:`, error);
    process.exit(1);
  });
}
