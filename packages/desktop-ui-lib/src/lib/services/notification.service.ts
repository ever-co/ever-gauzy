import { Injectable } from '@angular/core';

interface INotification {
	title: string;
	message: string;
}

@Injectable({
	providedIn: 'root'
})
export abstract class NotificationService {
	protected _notification: INotification;

	public abstract success(message: string): void;

	public abstract error(message: string): void;
}
