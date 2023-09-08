import { BaseError } from './base.error';
import log from 'electron-log';
import { ErrorEventManager } from './error-event-manager';

console.error = log.error;
Object.assign(console, log.functions);

export class UIError extends BaseError {
	private errorEventManager = ErrorEventManager.instance;

	constructor(code: string, message: string, errorId: string) {
		super(message);

		Error.captureStackTrace(this, this.constructor);

		this.name = this.constructor.name;
		this.code = code;
		this.id = errorId;

		console.error(errorId, message);

		switch (code) {
			case '500':
				this.errorEventManager.sendReport(this.message);
				break;
			case '400':
				this.errorEventManager.showError(this.message);
				break;
			default:
				this.errorEventManager.sendReport(this.message);
				break;
		}
	}
}
