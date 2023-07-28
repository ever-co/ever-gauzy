import { Injectable } from '@angular/core';
import { ITimeSlot } from '@gauzy/contracts';
import { Observable, Observer } from 'rxjs';
import { Updatable, ViewQueueStateUpdater } from './interfaces';

@Injectable({
	providedIn: 'root',
})
export class TimeSlotQueueService implements Updatable<ITimeSlot> {
	private _updater$: Observer<ITimeSlot>;
	private _viewQueueStateUpdater$: Observer<ViewQueueStateUpdater>;

	public set viewQueueStateUpdater(value: ViewQueueStateUpdater) {
		this._viewQueueStateUpdater$.next(value);
	}

	public get viewQueueStateUpdater$(): Observable<ViewQueueStateUpdater> {
		return new Observable<ViewQueueStateUpdater>(
			(observer) => (this._viewQueueStateUpdater$ = observer)
		);
	}

	public set updater(value: ITimeSlot) {
		this._updater$.next(value);
	}

	public get updater$(): Observable<ITimeSlot> {
		return new Observable<ITimeSlot>(
			(observer) => (this._updater$ = observer)
		);
	}
}
