import { Logger as NestLogger, LoggerService } from '@nestjs/common';

export class Logger extends NestLogger implements LoggerService {

	private static _instance: typeof Logger = Logger;
	private _prefix?: string | undefined;

	/**
	* Sets the prefix.
	* @param {string | undefined} prefix - The prefix to be set.
	* @returns {void}
	*/
	setPrefix(prefix: string | undefined): void {
		this._prefix = prefix;
	}

	/**
	* Gets the current prefix.
	* @returns {string | undefined} The current prefix.
	*/
	get prefix(): string | undefined {
		return this._prefix;
	}

	private static _logger: any;
	/**
	 * Gets the current logger.
	 * @returns {any} The current logger.
	 */
	static get logger(): any {
		return this._logger;
	}

	/**
	 * Sets the logger.
	 * @param {any} logger - The logger to be set.
	 * @returns {void}
	 */
	static setLogger(logger: any): void {
		Logger._logger = logger;
	}

	/**
	 * Gets the current instance of the logger.
	 * @returns {typeof Logger} The current instance of the logger.
	 */
	private get instance(): typeof Logger {
		return Logger._instance;
	}

	/**
	 * Logs a message with an optional context.
	 * @param {string} message - The message to be logged.
	 * @param {string} [context] - An optional context for the log message.
	 * @returns {void}
	 */
	log(message: string, context?: string): void {
		const formattedMessage = this.getFormattedMessage(message);
		this.instance.info(formattedMessage, context);
	}

	/**
	 * Logs an error message with an optional trace and context.
	 * @param {any} message - The error message to be logged.
	 * @param {string} [trace] - An optional trace information for the error.
	 * @param {string} [context] - An optional context for the log message.
	 * @returns {void}
	 */
	error(message: any, trace?: string, context?: string): void {
		this.instance.error(message, trace, context);
	}

	/**
	 * Formats the message with the prefix if it exists.
	 * @param {string} message - The original message.
	 * @returns {string} The formatted message.
	 */
	private getFormattedMessage(message: string): string {
		return this.prefix ? `[${this.prefix}] ${message}` : message;
	}

	/**
	 * Logs a warning message with an optional context.
	 * @param {string} message - The warning message to be logged.
	 * @param {string} [context] - An optional context for the log message.
	 * @returns {void}
	 */
	warn(message: string, context?: string): void {
		this.instance.warn(message, context);
	}

	/**
	 * Logs a debug message with an optional context.
	 * @param {string} message - The debug message to be logged.
	 * @param {string} [context] - An optional context for the log message.
	 * @returns {void}
	 */
	debug(message: string, context?: string): void {
		this.instance.debug(message, context);
	}

	/**
	 * Logs a verbose message with an optional context.
	 * @param {string} message - The verbose message to be logged.
	 * @param {string} [context] - An optional context for the log message.
	 * @returns {void}
	 */
	verbose(message: string, context?: string): void {
		this.instance.verbose(message, context);
	}


	/**
	 * Logs an error message with an optional context and trace.
	 * @param {string} message - The error message to be logged.
	 * @param {string} [context] - An optional context for the log message.
	 * @param {string} [trace] - An optional trace information for the error.
	 * @returns {void}
	 */
	static error(message: string, context?: string, trace?: string): void {
		Logger.logger.error(message, context, trace);
	}

	/**
	 * Logs a warning message with an optional context.
	 * @param {string} message - The warning message to be logged.
	 * @param {string} [context] - An optional context for the log message.
	 * @returns {void}
	 */
	static warn(message: string, context?: string): void {
		Logger.logger.warn(message, context);
	}

	/**
	 * Logs an informational message with an optional context.
	 * @param {string} message - The informational message to be logged.
	 * @param {string} [context] - An optional context for the log message.
	 * @returns {void}
	 */
	static info(message: string, context?: string): void {
		Logger.logger.info(message, context);
	}

	/**
	 * Logs a verbose message with an optional context.
	 * @param {string} message - The verbose message to be logged.
	 * @param {string} [context] - An optional context for the log message.
	 * @returns {void}
	 */
	static verbose(message: string, context?: string): void {
		Logger.logger.verbose(message, context);
	}


	/**
	 * Logs a debug message with an optional context.
	 * @param {string} message - The debug message to be logged.
	 * @param {string} [context] - An optional context for the log message.
	 * @returns {void}
	 */
	static debug(message: string, context?: string): void {
		Logger.logger.debug(message, context);
	}
}
