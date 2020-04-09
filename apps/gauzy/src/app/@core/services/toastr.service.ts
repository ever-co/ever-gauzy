import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
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

	success(
		message: any,
		title: string = 'TOASTR.TITLE.SUCCESS',
		translationParams: Object = {}
	) {
		let displayMesage: string = '';

		if (message && message.message && typeof message.message == 'string') {
			displayMesage = message.message;
		} else {
			displayMesage = message;
		}

		this.nbToastrService.success(
			this.getTranslation(displayMesage, translationParams),
			this.getTranslation(title)
		);
	}

	danger(
		error: any,
		title: string = 'TOASTR.TITLE.ERROR',
		translationParams: Object = {}
	) {
		let displayMesage: string = '';

		if (
			error.error &&
			error.error.message &&
			typeof error.error.message == 'string'
		) {
			displayMesage = error.error.message;
		} else if (error.message && typeof error.message == 'string') {
			displayMesage = error.message;
		} else {
			displayMesage = error;
		}

		this.nbToastrService.danger(
			this.getTranslation(displayMesage, translationParams),
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
		let result = '';
		this.translateService.get(prefix, params).subscribe((res) => {
			result = res;
		});
		return result;
	}
}
