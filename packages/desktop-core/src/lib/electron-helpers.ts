import ElectronLog from 'electron-log';
import ElectronStore from 'electron-store';
import { StoreSchema } from './interfaces/types';

// Set up the logger
console.log = ElectronLog.log;
Object.assign(console, ElectronLog.functions);

// Create a typed store instance
const Store = new ElectronStore<StoreSchema>();

// Export the logger and store
export { ElectronLog, Store };
