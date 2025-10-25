import { promises as fs } from 'fs';
import { ParsedAvailability } from './parser';

export interface StateData {
  lastCheck: string;
  lastAvailability: ParsedAvailability | null;
}

const STATE_FILE = 'state.json';

/**
 * Loads the last known state from state.json file
 */
export async function loadState(): Promise<StateData> {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf-8');
    const state = JSON.parse(data) as StateData;
    console.log(`[${new Date().toISOString()}] Loaded state from ${STATE_FILE}`);
    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log(`[${new Date().toISOString()}] No existing state file found, starting fresh`);
      return {
        lastCheck: new Date().toISOString(),
        lastAvailability: null
      };
    }
    console.error(`[${new Date().toISOString()}] Error loading state:`, error);
    throw error;
  }
}

/**
 * Saves the current state to state.json file
 */
export async function saveState(availability: ParsedAvailability): Promise<void> {
  try {
    const state: StateData = {
      lastCheck: new Date().toISOString(),
      lastAvailability: availability
    };

    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
    console.log(`[${new Date().toISOString()}] State saved to ${STATE_FILE}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error saving state:`, error);
    throw error;
  }
}
