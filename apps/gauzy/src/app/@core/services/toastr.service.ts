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

	success(message: any, title?: string, translationParams: Object = {}) {
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

	async danger(
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
			this.getTranslation(title)
		);
	}

	error(
		message: any,
		title: string = 'TOASTR.TITLE.ERROR',
		translationParams: Object = {}
	) {
		this.danger(message, title, translationParams);
	}

	private getTranslation(prefix: string, params?: Object) {
		return this.translateService.instant(prefix, params);
	}
}
