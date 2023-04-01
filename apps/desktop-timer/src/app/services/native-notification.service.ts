import { Injectable } from '@angular/core';
import { ElectronService } from '@gauzy/desktop-ui-lib';
import { NotificationService } from './notification.service';

@Injectable({
	providedIn: 'root',
})
export class NativeNotificationService extends NotificationService {
	constructor(
		private readonly _electronService: ElectronService
	) {
		super();
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
