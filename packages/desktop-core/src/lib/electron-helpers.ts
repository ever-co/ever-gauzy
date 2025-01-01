import { log, functions as logFunctions } from 'electron-log';
import * as ElectronStore from 'electron-store';
import { StoreSchema } from './interfaces/types';

/**
 * Sets up Electron logging by overriding console methods with Electron Log functions.
 */
const setupElectronLog = (): void => {
    Object.assign(console, { ...logFunctions, log });
    console.log('Electron logger has been initialized');
};

/**
 * Creates and exports a strongly-typed Electron Store instance.
 */
const store = new ElectronStore<StoreSchema>();

export { setupElectronLog, store as Store };
