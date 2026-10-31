import { Inject, Injectable, Optional } from '@angular/core';
import { NbToastRef, NbToastrConfig, NbToastrService } from '@nebular/theme';
import { GAUZY_ENV } from '../constants';
import { NotificationService } from './notification.service';

/**
 * In-app toasts, titled with the app's name. Each method takes an optional Nebular toastr `config` that is merged
 * over its defaults (e.g. `{ duration: 0 }` for a toast that stays until clicked), and answers the toast's reference
 * so a caller can close it.
 */
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

	public success(message: string, config?: Partial<NbToastrConfig>): NbToastRef {
		return this._toastrService.success(message, this._notification.title, {
			toastClass: 'toast-top-custom-title-bar',
			preventDuplicates: true,
			...config
		});
	}

	public error(message: string, config?: Partial<NbToastrConfig>): NbToastRef {
		return this._toastrService.danger(message, this._notification.title, {
			preventDuplicates: true,
			...config
		});
	}

	public warn(message: string, config?: Partial<NbToastrConfig>): NbToastRef {
		return this._toastrService.warning(message, this._notification.title, {
			preventDuplicates: true,
			...config
		});
	}

	public info(message: string, config?: Partial<NbToastrConfig>): NbToastRef {
		return this._toastrService.info(message, this._notification.title, {
			preventDuplicates: true,
			...config
		});
	}
}
