import { BaseError } from './base.error';
import log from 'electron-log';

console.error = log.error;
Object.assign(console, log.functions);

export class UIError extends BaseError {
	constructor(code: string, message: string, errorId: string) {
		super(message);

		Error.captureStackTrace(this, this.constructor);

		this.name = this.constructor.name;
		this.code = code;
		this.id = errorId;

		console.error(errorId, message);
	}
}
