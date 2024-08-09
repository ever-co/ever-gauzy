import { ErrorHandler, Inject, Injectable } from '@angular/core';
import * as Sentry from '@sentry/angular-ivy';
import { Environment, GAUZY_ENV } from '@gauzy/ui-config';

@Injectable()
export class SentryErrorHandler implements ErrorHandler {
	constructor(@Inject(GAUZY_ENV) private readonly environment: Environment) {}

	/**
	 * Handles an error by capturing it with Sentry and optionally showing a report dialog.
	 *
	 * @param error - The error to handle.
	 */
	handleError(error: any): void {
		// Check if Sentry DSN is provided in the environment configuration
		if (this.environment.SENTRY_DSN) {
			// Capture the error with Sentry and get the event ID
			const eventId = Sentry.captureException(error.originalError || error);

			// Optionally show the Sentry report dialog to the user
			Sentry.showReportDialog({ eventId });
		}

		// Rethrow the error to ensure that it is still propagated
		throw error;
	}
}
