import { Injectable } from '@angular/core';
import { NbToastRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { ToastrNotificationService } from '../../services/toastr-notification.service';
import { connectivityNotice } from './connectivity-notice';

/**
 * Tells the user, with an in-app toast, when the time tracker loses or gets back its connection to the API (#8415).
 * The footer already shows Online / Offline; the toast makes the change itself noticeable without blocking anything.
 *
 * - Offline: a warning that stays until the user clicks it, or until the connection is back.
 * - Back online: a success toast that goes away on its own.
 */
@Injectable({
	providedIn: 'root'
})
export class ConnectivityNotifierService {
	/** The open "you are offline" toast, closed as soon as the connection is back. */
	private _offlineToast: NbToastRef | null = null;

	constructor(
		private readonly _toastrNotifier: ToastrNotificationService,
		private readonly _translateService: TranslateService
	) {}

	/**
	 * Notifies a change from `wasOffline` to `isOffline`; does nothing when the state did not change.
	 * @param pendingCount entries waiting to be synced, named in the "back online" notice when there are some.
	 */
	public notify(wasOffline: boolean, isOffline: boolean, pendingCount = 0): void {
		const notice = connectivityNotice(wasOffline, isOffline, pendingCount);
		if (!notice) {
			return;
		}

		this._closeOfflineToast();
		const message = this._translateService.instant(notice.messageKey, notice.params);

		if (notice.state === 'offline') {
			// `duration: 0` keeps it until clicked (the toast closes on click) or until the connection is back.
			this._offlineToast = this._toastrNotifier.warn(message, { duration: 0 }) ?? null;
		} else {
			this._toastrNotifier.success(message);
		}
	}

	private _closeOfflineToast(): void {
		this._offlineToast?.close();
		this._offlineToast = null;
	}
}
