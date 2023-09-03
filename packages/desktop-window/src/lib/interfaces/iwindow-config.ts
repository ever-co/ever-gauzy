import { BrowserWindowConstructorOptions } from 'electron';

export interface IWindowConfig {
	options?: BrowserWindowConstructorOptions;
	path: string;
	hash: string;
}
