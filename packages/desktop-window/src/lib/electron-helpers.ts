import log from 'electron-log';
import Store from 'electron-store';
import { StoreSchema } from './types';

// Set up the logger
console.log = log.log;
Object.assign(console, log.functions);

// Create a typed store instance
const store = new Store<StoreSchema>();

// Export the logger and store
export { log, store };
