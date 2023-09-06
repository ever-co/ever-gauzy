import Sentry from '@sentry/electron';
import { BaseError } from './base.error';
import log from 'electron-log';

console.error = log.error;
Object.assign(console, log.functions);

export class AppError extends BaseError {
	constructor(errorId: string, message: string) {
		super(message);

		Error.captureStackTrace(this, this.constructor);

		this.name = this.constructor.name;
		this.code = errorId;

		console.error(errorId, message);

		Sentry.captureException(this);
	}
}
