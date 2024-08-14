import { Inject, Injectable } from '@angular/core';
import { NbToastrService } from '@nebular/theme';
import { NotificationService } from './notification.service';
import { GAUZY_ENV } from '../constants';

@Injectable({
	providedIn: 'root',
})
export class ToastrNotificationService extends NotificationService {
	constructor(
		private readonly _toastrService: NbToastrService,
		@Inject(GAUZY_ENV) environment: any
	) {
		super();
		this._notification = {
			title: environment.DESCRIPTION,
			message: '',
		};
	}

	public success(message: string): void {
		this._toastrService.success(message, this._notification.title, {
			toastClass: 'toast-top-custom-title-bar'
		});
	}

	public error(message: string): void {
		this._toastrService.danger(message, this._notification.title);
	}

	public warn(message: string): void {
		this._toastrService.warning(message, this._notification.title);
	}
}
