import { Inject, Injectable, Optional } from '@angular/core';
import { NbToastrService } from '@nebular/theme';
import { GAUZY_ENV } from '../constants';
import { NotificationService } from './notification.service';

@Injectable({
	providedIn: 'root'
})
export class ToastrNotificationService extends NotificationService {
	constructor(
		private readonly _toastrService: NbToastrService,
		@Optional()
		@Inject(GAUZY_ENV)
		environment: any
	) {
		super();
		this._notification = {
			title: environment?.DESCRIPTION || 'Gauzy',
			message: ''
		};
	}

	public success(message: string): void {
		this._toastrService.success(message, this._notification.title, {
			toastClass: 'toast-top-custom-title-bar',
			preventDuplicates: true
		});
	}

	public error(message: string): void {
		this._toastrService.danger(message, this._notification.title, {
			preventDuplicates: true
		});
	}

	public warn(message: string): void {
		this._toastrService.warning(message, this._notification.title, {
			preventDuplicates: true
		});
	}

	public info(message: string): void {
		this._toastrService.info(message, this._notification.title, {
			preventDuplicates: true
		});
	}
}
