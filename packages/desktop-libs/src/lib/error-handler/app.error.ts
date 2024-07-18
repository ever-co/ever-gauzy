import * as Sentry from '@sentry/electron';
import { BaseError } from './base.error';
import { ErrorEventManager } from './error-event-manager';

import log from 'electron-log';
console.error = log.error;
Object.assign(console, log.functions);

export class AppError extends BaseError {
	private errorEventManager = ErrorEventManager.instance;

	constructor(errorId: string, error: any) {
		super(String(error?.message || error));

		Error.captureStackTrace(this, this.constructor);

		this.name = this.constructor.name;
		this.code = errorId;

		console.error(errorId, error);

		Sentry.captureException(this);
		Sentry.captureMessage(this.message);

		this.errorEventManager.sendReport(error?.stack || this.message);
	}
}
