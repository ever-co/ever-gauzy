import { Inject, Injectable } from '@angular/core';
import { ElectronService } from '../electron/services';
import { NotificationService } from './notification.service';
import { GAUZY_ENV } from '../constants';

@Injectable({
	providedIn: 'root',
})
export class NativeNotificationService extends NotificationService {
	constructor(
		private readonly _electronService: ElectronService,
		@Inject(GAUZY_ENV) environment: any
	) {
		super();
		this._notification = {
			title: environment.DESCRIPTION,
			message: '',
		};
	}

	public success(message: string): void {
		this._notification.message = message;
		this._electronService.ipcRenderer.send('notify', this._notification);
	}

	public error(message: string): void {
		this._notification.message = message;
		this._electronService.ipcRenderer.send('notify', this._notification);
	}
}
