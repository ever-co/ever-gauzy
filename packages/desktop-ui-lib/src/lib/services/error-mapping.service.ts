import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
@Injectable({
	providedIn: 'root',
})
export class ErrorMapping {
	constructor(
		private readonly _translateService: TranslateService
	) {}
	public mapErrorMessage(error: HttpErrorResponse): string {
		if (error.error instanceof ErrorEvent) {
			return this._translateService.instant('TIMER_TRACKER.TOASTR.NETWORK_ERROR', { message: error.error.message });
		}

		switch (error.status) {
			case 0:
				return this._translateService.instant('TIMER_TRACKER.TOASTR.NO_INTERNET_CONNECTION');
			case 400:
				return this.extractMessage(error, this._translateService.instant('TIMER_TRACKER.TOASTR.BAD_REQUEST'));
			case 401:
				return this._translateService.instant('TIMER_TRACKER.TOASTR.UNAUTHORIZED');
			case 403:
				return this._translateService.instant('TIMER_TRACKER.TOASTR.ACCESS_DENIED');
			case 404:
				return this._translateService.instant('TIMER_TRACKER.TOASTR.NOT_FOUND');
			case 408:
				return this._translateService.instant('TIMER_TRACKER.TOASTR.TIMEOUT');
			case 500:
				return this._translateService.instant('TIMER_TRACKER.TOASTR.SERVER_ERROR');
			case 413:
				return this._translateService.instant('TIMER_TRACKER.TOASTR.LARGE_FILE');
			case 503:
				return this._translateService.instant('TIMER_TRACKER.TOASTR.SERVICE_UNAVAILABLE');
			default:
				return this.extractMessage(error, this._translateService.instant('TIMER_TRACKER.TOASTR.UNEXPECTED_ERROR'));
		}
	}


	private extractMessage(error: HttpErrorResponse, fallback: string): string {
		if (error.error?.message) return error.error.message;
		if (typeof error.error === 'string') return error.error;
		return fallback;
	}
}
