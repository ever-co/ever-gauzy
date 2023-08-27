import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, ErrorHandler } from '@angular/core';
import { ToastrNotificationService } from './toastr-notification.service';
import { ErrorClientService } from './error-client.service';
import { ErrorServerService } from './error-server.service';
import { LoggerService } from '../electron/services';

@Injectable({
	providedIn: 'root',
})
export class ErrorHandlerService implements ErrorHandler {
	constructor(
		private readonly _toastrNotifierService: ToastrNotificationService,
		private readonly _errorClientService: ErrorClientService,
		private readonly _errorServerService: ErrorServerService,
		private readonly _loggerService: LoggerService
	) {
		console.error = _loggerService.log.error;
		Object.assign(console, _loggerService.log.functions);
	}

	public handleError(error: Error | HttpErrorResponse): void {
		let message: string;
		if (error instanceof HttpErrorResponse) {
			this._errorServerService.message = error;
			message = this._errorServerService.message;
		} else {
			this._errorClientService.message = error;
			message = this._errorClientService.message;
			this._loggerService.log.debug(this._errorClientService.stack);
		}

		/** Override the AW error message */
		if (message.includes('localhost:5600/api')) {
			console.error('ActivityWatch service is not available');
			return;
		}

		this._toastrNotifierService.error(message);
		console.error(error);
	}
}
