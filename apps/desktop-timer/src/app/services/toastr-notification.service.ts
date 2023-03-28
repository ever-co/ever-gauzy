import { Injectable } from '@angular/core';
import { NbToastrService } from '@nebular/theme';
import { NotificationService } from './notification.service';

@Injectable({
	providedIn: 'root',
})
export class ToastrNotificationService extends NotificationService {
	constructor(private readonly _toastrService: NbToastrService) {
		super();
	}

	public success(message: string): void {
		this._toastrService.success(message, this._notification.title);
	}

	public error(message: string): void {
		this._toastrService.danger(message, this._notification.title);
	}

	public warn(message: string): void {
		this._toastrService.warning(message, this._notification.title);
	}
}
