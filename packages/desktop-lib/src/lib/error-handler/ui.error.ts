import { BaseError } from './base.error';
import { ErrorEventManager } from './error-event-manager';

export class UIError extends BaseError {
	private errorEventManager = ErrorEventManager.instance;

	constructor(code: string, error: any, errorId: string) {
		super(String(error?.message || error));

		Error.captureStackTrace(this, this.constructor);

		this.name = this.constructor.name;
		this.code = code;
		this.id = errorId;

		console.error(errorId, error);

		switch (code) {
			case '500':
				this.errorEventManager.sendReport(error?.stack || this.message);
				break;
			case '400':
				this.errorEventManager.showError(this.message);
				break;
			default:
				this.errorEventManager.sendReport(error?.stack || this.message);
				break;
		}
	}
}
