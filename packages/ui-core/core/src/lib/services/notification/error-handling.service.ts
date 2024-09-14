import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { HttpStatus } from '@gauzy/contracts';
import { ToastrService } from './toastr.service';

@Injectable({
	providedIn: 'root'
})
export class ErrorHandlingService {
	constructor(private _toastrService: ToastrService) {}

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
		let title = 'Error';
		let message = 'An unexpected error occurred';

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
				title = 'Bad Request';
				message = message || 'The request could not be understood or was missing required parameters.';
				break;
			case HttpStatus.UNAUTHORIZED:
				title = 'Unauthorized';
				message = message || 'Authentication is required and has failed or has not yet been provided.';
				break;
			case HttpStatus.FORBIDDEN:
				title = 'Forbidden';
				message = message || 'You do not have permission to access the requested resource.';
				break;
			case HttpStatus.NOT_FOUND:
				title = 'Not Found';
				message = message || 'The requested resource could not be found.';
				break;
			case HttpStatus.CONFLICT:
				title = 'Conflict';
				message = message || 'There was a conflict with the current state of the resource.';
				break;
			case HttpStatus.INTERNAL_SERVER_ERROR:
				title = 'Server Error';
				message = message || 'An error occurred on the server.';
				break;
			case HttpStatus.GATEWAY_TIMEOUT:
				title = 'Gateway Timeout';
				message = message || 'The server took too long to respond.';
				break;
			case HttpStatus.SERVICE_UNAVAILABLE:
				title = 'Service Unavailable';
				message = message || 'The service is temporarily unavailable. Please try again later.';
				break;
			case 0:
				title = 'Network Error';
				message = 'Unable to connect to the server. Please check your network connection.';
				break;
			default:
				title = 'Error';
				message = message || 'An unexpected error occurred.';
				break;
		}

		// Special handling for HTTP failure responses
		if (message.includes('Http failure response')) {
			title = 'Connection Error';
			message = 'Lost connection with the server. Please try again later.';
		}

		return { title, message };
	}
}
