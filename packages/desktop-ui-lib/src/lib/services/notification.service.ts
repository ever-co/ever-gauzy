import { Injectable } from '@angular/core';
import { GAUZY_ENV, injector } from '../constants';

interface INotification {
	title: string;
	message: string;
}

@Injectable({
	providedIn: 'root'
})
export abstract class NotificationService {
	protected _notification: INotification;

	protected constructor() {
		const environment = injector.get(GAUZY_ENV);
		this._notification = {
			title: environment.DESKTOP_TIMER_APP_DESCRIPTION,
			message: '',
		};
	}

	public abstract success(message: string): void;

	public abstract error(message: string): void;
}
