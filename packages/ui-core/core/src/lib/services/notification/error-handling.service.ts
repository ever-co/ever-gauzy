import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { HttpStatus } from '@gauzy/contracts';
import { ToastrService } from './toastr.service';
import { ERROR_MESSAGES } from './constants';

@Injectable({
	providedIn: 'root'
})
export class ErrorHandlingService {
	constructor(private readonly _toastrService: ToastrService) {}

	/**
	 * Handles HTTP errors and displays an appropriate message.
	 * @param err - The HttpErrorResponse object.
	 * @param duration - Duration for which the toast message is displayed.
	 */
	public handleError(error: any, duration = 3000): void {
		const details = this.getErrorDetails(error);
		this._toastrService.error(details.message, details.title, { duration });
	}

	/**
	 * Determines the type of error and sets the appropriate title and content based on the status code.
	 * @param err - The HttpErrorResponse object.
	 * @returns An object containing the error title and content.
	 */
	private getErrorDetails(err: HttpErrorResponse): { title: string; message: string } {
		let title = 'DEFAULT_ERRORS.TITLE.DEFAULT';
		let message = 'DEFAULT_ERRORS.MESSAGES.DEFAULT';

		// Extracting the error message from response body if available
		if (err.error) {
			if (err.error.message) {
				message = Array.isArray(err.error.message) ? err.error.message.join(', ') : err.error.message;
			}
			if (err.error.detail) {
				message = err.error.detail;
			}
		}

		// Switch based on the HTTP status code using HttpStatus constants
		switch (err.status) {
			case HttpStatus.BAD_REQUEST:
				title = 'DEFAULT_ERRORS.TITLE.BAD_REQUEST';
				message = ERROR_MESSAGES[message] || message || 'DEFAULT_ERRORS.MESSAGES.BAD_REQUEST';
				break;
			case HttpStatus.UNAUTHORIZED:
				title = 'DEFAULT_ERRORS.TITLE.UNAUTHORIZED';
				message = ERROR_MESSAGES[message] || message || 'DEFAULT_ERRORS.MESSAGES.UNAUTHORIZED';
				break;
			case HttpStatus.FORBIDDEN:
				title = 'DEFAULT_ERRORS.TITLE.FORBIDDEN';
				message = ERROR_MESSAGES[message] || message || 'DEFAULT_ERRORS.MESSAGES.FORBIDDEN';
				break;
			case HttpStatus.NOT_FOUND:
				title = 'DEFAULT_ERRORS.TITLE.NOT_FOUND';
				message = ERROR_MESSAGES[message] || message || 'DEFAULT_ERRORS.MESSAGES.NOT_FOUND';
				break;
			case HttpStatus.CONFLICT:
				title = 'DEFAULT_ERRORS.TITLE.CONFLICT';
				message = ERROR_MESSAGES[message] || message || 'DEFAULT_ERRORS.MESSAGES.CONFLICT';
				break;
			case HttpStatus.INTERNAL_SERVER_ERROR:
				title = 'DEFAULT_ERRORS.TITLE.INTERNAL_SERVER_ERROR';
				message = ERROR_MESSAGES[message] || message || 'DEFAULT_ERRORS.MESSAGES.INTERNAL_SERVER_ERROR';
				break;
			case HttpStatus.GATEWAY_TIMEOUT:
				title = 'DEFAULT_ERRORS.TITLE.GATEWAY_TIMEOUT';
				message = ERROR_MESSAGES[message] || message || 'DEFAULT_ERRORS.MESSAGES.GATEWAY_TIMEOUT';
				break;
			case HttpStatus.SERVICE_UNAVAILABLE:
				title = 'DEFAULT_ERRORS.TITLE.SERVICE_UNAVAILABLE';
				message = ERROR_MESSAGES[message] || message || 'DEFAULT_ERRORS.MESSAGES.SERVICE_UNAVAILABLE';
				break;
			case 0:
				title = 'DEFAULT_ERRORS.TITLE.NETWORK_ERROR';
				message = 'DEFAULT_ERRORS.MESSAGES.NETWORK_ERROR';
				break;
			default:
				message = 'DEFAULT_ERRORS.MESSAGES.DEFAULT';
				break;
		}

		// Special handling for HTTP failure responses
		if (message.includes('Http failure response')) {
			title = 'DEFAULT_ERRORS.TITLE.CONNECTION_ERROR';
			message = 'DEFAULT_ERRORS.MESSAGES.CONNECTION_ERROR';
		}

		return { title, message };
	}
}
