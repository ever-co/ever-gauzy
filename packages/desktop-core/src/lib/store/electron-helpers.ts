import * as ElectronStore from 'electron-store';
import { StoreSchema } from './types';

/**
 * Creates and exports a strongly-typed Electron Store instance.
 */
const store = new ElectronStore<StoreSchema>();

export { store };
