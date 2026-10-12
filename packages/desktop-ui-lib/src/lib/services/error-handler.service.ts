import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, ErrorHandler, Provider } from '@angular/core';
import { ToastrNotificationService } from './toastr-notification.service';
import { ErrorClientService } from './error-client.service';
import { ErrorServerService } from './error-server.service';
import { LoggerService } from '../electron/services';
import { ErrorMapping } from './error-mapping.service';

@Injectable({
	providedIn: 'root',
})
export class ErrorHandlerService implements ErrorHandler {
	constructor(
		private readonly _toastrNotifierService: ToastrNotificationService,
		private readonly _errorClientService: ErrorClientService,
		private readonly _errorServerService: ErrorServerService,
		private readonly _loggerService: LoggerService,
		private readonly _errorMapping: ErrorMapping
	) {
		console.error = _loggerService.log.error;
		Object.assign(console, _loggerService.log.functions);
	}

	public handleError(error: Error | HttpErrorResponse): void {
		let message: string;
		if (error instanceof HttpErrorResponse) {
			message = this._errorMapping.mapErrorMessage(error);
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

/**
 * Provides the single app-wide ErrorHandler. Angular only keeps the last ErrorHandler provider,
 * so this forwards each uncaught error to the given reporting handler (e.g. Sentry) and then to ErrorHandlerService.
 */
export function provideGlobalErrorHandler(reportingErrorHandler: ErrorHandler): Provider {
	return {
		provide: ErrorHandler,
		useFactory: (errorHandlerService: ErrorHandlerService): ErrorHandler => ({
			handleError: (error: any) => {
				try {
					reportingErrorHandler.handleError(error);
				} finally {
					// ErrorClientService reads `error.message`, so a nullish value (e.g. `throw null`) must be wrapped
					errorHandlerService.handleError(error ?? new Error(String(error)));
				}
			}
		}),
		deps: [ErrorHandlerService]
	};
}
