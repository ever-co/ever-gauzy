import { Injectable, ErrorHandler } from '@angular/core';
import * as Sentry from '@sentry/browser';

@Injectable()
export class SentryErrorHandler implements ErrorHandler {
	constructor() {}
	handleError(error) {
		//const eventId = Sentry.captureException(error.originalError || error);
		Sentry.captureException(error.originalError || error);
		//Sentry.showReportDialog({ eventId });
		throw error;
	}
}
