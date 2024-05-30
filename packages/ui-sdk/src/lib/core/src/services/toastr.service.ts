import { Injectable } from '@angular/core';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
	providedIn: 'root'
})
export class ToastrService {
	constructor(
		private readonly nbToastrService: NbToastrService,
		private readonly translateService: TranslateService
	) {}

	success(message: any, translationParams: Object = {}, title?: string) {
		let displayMessage = '';

		if (message && message.message && typeof message.message === 'string') {
			displayMessage = message.message;
		} else {
			displayMessage = message;
		}

		this.nbToastrService.primary(
			this.getTranslation(displayMessage, translationParams),
			this.getTranslation(title || 'TOASTR.TITLE.SUCCESS')
		);
	}

	warning(message: any, translationParams: Object = {}, title?: string) {
		let displayMessage = '';

		if (message && message.message && typeof message.message === 'string') {
			displayMessage = message.message;
		} else {
			displayMessage = message;
		}

		this.nbToastrService.warning(
			this.getTranslation(displayMessage, translationParams),
			this.getTranslation(title || 'TOASTR.TITLE.WARNING')
		);
	}

	danger(
		error: any,
		title: string = 'TOASTR.TITLE.ERROR',
		translationParams: Object = {}
	) {
		let displayMessage = '';

		if (
			error.error &&
			error.error.message &&
			typeof error.error.message === 'string'
		) {
			displayMessage = error.error.message;
		} else if (error.message && typeof error.message === 'string') {
			displayMessage = error.message;
		} else {
			displayMessage = error;
		}

		this.nbToastrService.danger(
			this.getTranslation(displayMessage, translationParams),
			this.getTranslation(title || 'TOASTR.TITLE.ERROR')
		);
	}

	error(
		message: any,
		title: string = 'TOASTR.TITLE.ERROR',
		translationParams: Object = {}
	) {
		this.danger(message, title, translationParams);
	}

	info(
		message: any,
		title: string,
		options: Object = {
			duration: 5000,
			preventDuplicates: true
		}
	) {
		this.nbToastrService.info(
			message,
			this.getTranslation(title || 'TOASTR.TITLE.INFO'),
			options
		);
	}

	private getTranslation(prefix: string, params?: Object) {
		return this.translateService.instant(prefix, params);
	}
}
