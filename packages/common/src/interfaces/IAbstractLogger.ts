
/**
 * Represents an abstract logger with various log levels.
 */
export interface AbstractLogger {
	/**
	 * Logs a message with an optional context.
	 * @param message - The message to be logged.
	 * @param context - An optional context for the log message.
	 * @returns The logger instance for chaining.
	 */
	log(message: any, context?: string): any;

	/**
	 * Logs an error message with an optional trace and context.
	 * @param message - The error message to be logged.
	 * @param trace - An optional trace information for the error.
	 * @param context - An optional context for the log message.
	 * @returns The logger instance for chaining.
	 */
	error(message: any, trace?: string, context?: string): any;

	/**
	 * Logs a warning message with an optional context.
	 * @param message - The warning message to be logged.
	 * @param context - An optional context for the log message.
	 * @returns The logger instance for chaining.
	 */
	warn(message: any, context?: string): any;

	/**
	 * Logs a debug message with an optional context.
	 * @param message - The debug message to be logged.
	 * @param context - An optional context for the log message.
	 * @returns The logger instance for chaining.
	 */
	debug?(message: any, context?: string): any;

	/**
	 * Logs a verbose message with an optional context.
	 * @param message - The verbose message to be logged.
	 * @param context - An optional context for the log message.
	 * @returns The logger instance for chaining.
	 */
	verbose?(message: any, context?: string): any;
}
