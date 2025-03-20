import { Injectable } from '@angular/core';
import { NbToastrConfig, NbToastrService } from '@nebular/theme';
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
	success(message: any, translationParams: any = {}, title?: string): void {
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
	warning(message: any, translationParams: any = {}, title?: string): void {
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
	danger(
		error: any,
		title = 'TOASTR.TITLE.ERROR',
		translationParams: any = {},
		config?: Partial<NbToastrConfig>
	): void {
		const displayMessage = this.extractErrorMessage(error);
		this._nbToastrService.danger(
			this._i18nService.translate(displayMessage, translationParams),
			this._i18nService.translate(title || 'TOASTR.TITLE.ERROR'),
			config
		);
	}

	/**
	 * Displays an error toast message. Alias for danger method.
	 * @param message The message or object containing the message to display.
	 * @param title The title of the toast message.
	 * @param translationParams Optional translation parameters.
	 */
	error(message: any, title = 'TOASTR.TITLE.ERROR', translationParams: any = {}): void {
		this.danger(message, title, translationParams);
	}

	/**
	 * Displays an info toast message
	 * @param message The message to display.
	 * @param title The title of the toast message.
	 * @param options Additional options for the toast message.
	 */
	info(
		message: any,
		title: string,
		options: Partial<NbToastrConfig> = {
			duration: 5000,
			preventDuplicates: true
		}
	): void {
		this._nbToastrService.info(
			this._i18nService.translate(message),
			this._i18nService.translate(title || 'TOASTR.TITLE.INFO'),
			options
		);
	}

	/**
	 * Extracts the message from a message object or string.
	 * @param message The message object or string.
	 * @returns The extracted message string.
	 */
	private extractMessage(message: any): string {
		if (message?.message && typeof message?.message === 'string') {
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
		if (error?.error?.message && typeof error?.error?.message === 'string') {
			return error.error.message;
		} else if (error.message && typeof error.message === 'string') {
			return error.message;
		}
		return error;
	}
}
