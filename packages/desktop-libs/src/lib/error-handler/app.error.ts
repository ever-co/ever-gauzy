import * as Sentry from '@sentry/electron';
import { BaseError } from './base.error';
import log from 'electron-log';
import { ErrorEventManager } from './error-event-manager';

console.error = log.error;
Object.assign(console, log.functions);

export class AppError extends BaseError {
	private erroEventManager = ErrorEventManager.instance;

	constructor(errorId: string, message: string) {
		super(message);

		Error.captureStackTrace(this, this.constructor);

		this.name = this.constructor.name;
		this.code = errorId;

		console.error(errorId, message);

		Sentry.captureException(this);

		this.erroEventManager.sendReport(this.message);
	}
}
