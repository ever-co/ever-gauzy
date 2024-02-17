import { ErrorHandler, Inject, Injectable } from '@angular/core';
import * as Sentry from '@sentry/angular-ivy';
import { Environment } from '../../environments/model';
import { GAUZY_ENV } from './constants';

@Injectable()
export class SentryErrorHandler implements ErrorHandler {
	constructor(@Inject(GAUZY_ENV) private readonly environment: Environment) {}

	handleError(error) {
		if (this.environment.SENTRY_DSN) {
			const eventId = Sentry.captureException(error.originalError || error);
			Sentry.showReportDialog({ eventId });
		}

		throw error;
	}
}
