import { ErrorHandler, Inject, Injectable } from '@angular/core';
// V9 Migration: @sentry/angular-ivy was removed, use @sentry/angular instead
// Reference: https://docs.sentry.io/platforms/javascript/migration/v8-to-v9/
import * as Sentry from '@sentry/angular';
import { Environment, GAUZY_ENV } from '@gauzy/ui-config';

@Injectable()
export class SentryErrorHandler implements ErrorHandler {
	constructor(@Inject(GAUZY_ENV) private readonly environment: Environment) {}

	/**
	 * Handles an error by capturing it with Sentry and optionally showing a report dialog.
	 * V9 Migration: showReportDialog is still available in v9 and works the same way
	 * Reference: https://docs.sentry.io/platforms/javascript/user-feedback/configuration/
	 *
	 * @param error - The error to handle.
	 */
	handleError(error: any): void {
		// Check if Sentry DSN is provided in the environment configuration
		if (this.environment.SENTRY_DSN) {
			// Capture the error with Sentry and get the event ID
			const eventId = Sentry.captureException(error.originalError || error);

			// V9 Migration: showReportDialog is still available and works the same way in v9
			// Must provide a valid eventId when calling showReportDialog
			Sentry.showReportDialog({ eventId });
		}

		// Rethrow the error to ensure that it is still propagated
		throw error;
	}
}
