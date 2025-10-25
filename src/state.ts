import { promises as fs } from 'fs';
import { ParsedAvailability } from './parser';

export interface StateData {
  lastCheck: string;
  lastAvailability: ParsedAvailability | null;
}

const STATE_FILE = 'state.json';

export async function loadState(): Promise<StateData> {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf-8');
    return JSON.parse(data) as StateData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        lastCheck: new Date().toISOString(),
        lastAvailability: null
      };
    }
    throw error;
  }
}

export async function saveState(availability: ParsedAvailability): Promise<void> {
  const state: StateData = {
    lastCheck: new Date().toISOString(),
    lastAvailability: availability
  };

  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}