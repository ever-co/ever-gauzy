import { Inject, Injectable, Optional } from '@angular/core';
import { ElectronService } from '../electron/services';
import { NotificationService } from './notification.service';
import { GAUZY_ENV } from '../constants';

@Injectable({
	providedIn: 'root'
})
export class NativeNotificationService extends NotificationService {
	constructor(
		private readonly _electronService: ElectronService,
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
		this._notification.message = message;
		this._electronService.ipcRenderer.send('notify', this._notification);
	}

	public error(message: string): void {
		this._notification.message = message;
		this._electronService.ipcRenderer.send('notify', this._notification);
	}
}
