import { Injectable } from '@angular/core';
import { NbToastrService } from '@nebular/theme';
import { I18nService } from '@gauzy/ui-core/i18n';

@Injectable({
	providedIn: 'root'
})
export class ToastrService {
	constructor(readonly _nbToastrService: NbToastrService, readonly _i18nService: I18nService) {}

	/**
	 * Displays a success toast message
	 * @param message The message or object containing the message to display.
	 * @param translationParams Optional translation parameters.
	 * @param title The title of the toast message.
	 */
	success(message: any, translationParams: Object = {}, title?: string): void {
		const displayMessage = this.extractMessage(message);
		this._nbToastrService.primary(
			this._i18nService.translate(displayMessage, translationParams),
			this._i18nService.translate(title || 'TOASTR.TITLE.SUCCESS')
		);
	}

	/**
	 * Displays a warning toast message
	 * @param message The message or object containing the message to display.
	 * @param translationParams Optional translation parameters.
	 * @param title The title of the toast message.
	 */
	warning(message: any, translationParams: Object = {}, title?: string): void {
		const displayMessage = this.extractMessage(message);
		this._nbToastrService.warning(
			this._i18nService.translate(displayMessage, translationParams),
			this._i18nService.translate(title || 'TOASTR.TITLE.WARNING')
		);
	}

	/**
	 * Displays a danger (error) toast message
	 * @param error The error object or message to display.
	 * @param title The title of the toast message.
	 * @param translationParams Optional translation parameters.
	 */
	danger(error: any, title: string = 'TOASTR.TITLE.ERROR', translationParams: Object = {}): void {
		const displayMessage = this.extractErrorMessage(error);
		this._nbToastrService.danger(
			this._i18nService.translate(displayMessage, translationParams),
			this._i18nService.translate(title || 'TOASTR.TITLE.ERROR')
		);
	}

	/**
	 * Displays an error toast message. Alias for danger method.
	 * @param message The message or object containing the message to display.
	 * @param title The title of the toast message.
	 * @param translationParams Optional translation parameters.
	 */
	error(message: any, title: string = 'TOASTR.TITLE.ERROR', translationParams: Object = {}): void {
		this.danger(message, title, translationParams);
	}

	/**
	 * Displays an info toast message
	 * @param message The message to display.
	 * @param title The title of the toast message.
	 * @param options Additional options for the toast message.
	 */
	info(message: any, title: string, options?: any): void {
		options = {
			duration: 5000,
			preventDuplicates: true,
			translationParams: {},
			...options
		};
		this._nbToastrService.info(
			this._i18nService.translate(message, options.translationParams),
			this._i18nService.translate(title || 'TOASTR.TITLE.INFO'),
			options
		);
	}

	/**``
	 * Extracts the message from a message object or string.
	 * @param message The message object or string.
	 * @returns The extracted message string.
	 */
	private extractMessage(message: any): string {
		if (message && message.message && typeof message.message === 'string') {
			return message.message;
		}
		return message;
	}

	/**
	 * Extracts the error message from an error object or string.
	 * @param error The error object or string.
	 * @returns The extracted error message string.
	 */
	private extractErrorMessage(error: any): string {
		// A NestJS ValidationPipe 400 carries `message` as an ARRAY of validator
		// sentences. Before this branch existed those fell through to Angular's
		// synthetic "Http failure response for <url>: 400 OK" — the least useful
		// string in the whole object.
		if (Array.isArray(error?.error?.message) && error.error.message.length) {
			return error.error.message.join('; ');
		}
		if (error.error && error.error.message && typeof error.error.message === 'string') {
			return error.error.message;
		} else if (error.message && typeof error.message === 'string') {
			return error.message;
		}
		return error;
	}
}
