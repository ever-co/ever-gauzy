import * as ElectronLog from 'electron-log';
import { log, functions as logFunctions } from 'electron-log';
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

	/**
	 * Starts catching uncaught errors and unhandled promise rejections of this process.
	 *
	 * A method calling electron-log's error handler, not a getter handing out electron-log's own
	 * `catchErrors`: since electron-log 5 that is a deprecated prototype method that needs electron-log's
	 * logger as `this`, and `logger.catchErrors(...)` called it with this Logger instead — the desktop
	 * apps using this logger stopped at startup on "this.processMessage is not a function".
	 */
	public catchErrors(options?: ElectronLog.MainErrorHandlerOptions): ElectronLog.ErrorHandler<ElectronLog.MainErrorHandlerOptions> {
		ElectronLog.errorHandler.startCatching(options);
		return ElectronLog.errorHandler;
	}
}

export const logger = new Logger();
