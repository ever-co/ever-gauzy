import ElectronLog, { log, functions as logFunctions } from 'electron-log';
import { ILogger } from './types';

export class Logger implements ILogger {
	constructor(private readonly name = process.env.DESCRIPTION || 'Gauzy') {}

	public setup(): void {
		Object.assign(console, { ...logFunctions, log });
		this.info('Electron logger has been initialized');
	}

	public info(...message: any[]): void {
		ElectronLog.info(`[${this.name}]`, ...message);
	}

	public error(...message: any[]): void {
		ElectronLog.error(`[${this.name}]`, ...message);
	}

	public warn(...message: any[]): void {
		ElectronLog.warn(`[${this.name}]`, ...message);
	}

	public debug(...message: any[]): void {
		ElectronLog.debug(`[${this.name}]`, ...message);
	}

	public get catchErrors() {
		return ElectronLog.catchErrors;
	}
}

export const logger = new Logger();
