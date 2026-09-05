import { LoggerService } from '@nestjs/common';
import { isDevelopment } from '@gauzy/config';

/**
 * Emits a DEBUG entry only when the API runs as a development instance (see `isDevelopment`).
 * The message is built lazily, so hot paths never pay for it outside a development runtime.
 * Needed because the application enables every log level at bootstrap, so `logger.debug`
 * alone would still print, and still build its message, everywhere.
 *
 * @param logger - The logger of the calling service
 * @param message - Builds the message; only called when it will be printed
 */
export function debugInDevelopment(logger: LoggerService, message: () => string): void {
	if (isDevelopment()) {
		logger.debug?.(message());
	}
}
