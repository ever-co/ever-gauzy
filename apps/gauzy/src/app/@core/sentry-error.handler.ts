import { Injectable, ErrorHandler } from '@angular/core';
import * as Sentry from '@sentry/angular';
import { environment } from '../../environments/environment';

@Injectable()
export class SentryErrorHandler implements ErrorHandler {
	constructor() {}

	handleError(error) {
		if (environment.SENTRY_DSN) {
			const eventId = Sentry.captureException(
				error.originalError || error
			);
			Sentry.showReportDialog({ eventId });
		}

		throw error;
	}
}
