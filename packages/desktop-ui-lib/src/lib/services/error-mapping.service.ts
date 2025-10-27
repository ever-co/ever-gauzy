import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
@Injectable({
	providedIn: 'root',
})
export class ErrorMapping {
	public mapErrorMessage(error: HttpErrorResponse): string {
		if (error.error instanceof ErrorEvent) {
			// Client-side or network error
			return `Network error: ${error.error.message}`;
		}

		switch (error.status) {
			case 0:
				return 'No connection — please check your internet.';
			case 400:
				return this.extractMessage(error, 'Bad Request');
			case 401:
				return 'Unauthorized. Please login again.';
			case 403:
				return 'Access denied. You don’t have permission.';
			case 404:
				return 'Not found. The requested resource does not exist.';
			case 408:
				return 'Request timeout. Please try again.';
			case 500:
				return 'Server error. Please contact support.';
			case 413:
				return 'The file or data is too large.';
			case 503:
				return 'Service unavailable. Try again later.';
			default:
				return this.extractMessage(error, 'Unexpected error occurred.');
		}
	}


	private extractMessage(error: HttpErrorResponse, fallback: string): string {
		if (error.error?.message) return error.error.message;
		if (typeof error.error === 'string') return error.error;
		return fallback;
	}
}
