import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, ErrorHandler } from '@angular/core';
import { ToastrNotificationService } from './toastr-notification.service';
import { ErrorClientService } from './error-client.service';
import { ErrorServerService } from './error-server.service';
import { LoggerService } from '@gauzy/desktop-ui-lib';

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
		this._toastrNotifierService.error(message);
		console.error(error);
	}
}
