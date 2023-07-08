import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { ITimerStatus, TimeLogSourceEnum } from '@gauzy/contracts';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { TimeTrackerService } from '../../time-tracker.service';
import { TimerIconFactory } from './factory';
import { ITimerSynced, ITimerIcon } from './interfaces';
import { TimerSynced } from './concretes';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-time-tracker-status',
	templateUrl: './time-tracker-status.component.html',
	styleUrls: ['./time-tracker-status.component.scss']
})
export class TimeTrackerStatusComponent implements OnInit {
	private _icon$: BehaviorSubject<ITimerIcon> = new BehaviorSubject<ITimerIcon>(null);
	private _external: EventEmitter<ITimerSynced> = new EventEmitter<ITimerSynced>();

	constructor(private readonly _timeTrackerService: TimeTrackerService) {}

	ngOnInit(): void {
		this._timeTrackerService.timer$
			.pipe(
				tap(async () => {
					const status = await this._status;
					const source = status.lastLog.source as TimeLogSourceEnum;
					this._icon$.next(TimerIconFactory.create(source));
					if (!status.running) this._icon$.next(null);
					if (status.lastLog.source !== TimeLogSourceEnum.WEB_TIMER) {
						this._external.emit(
							new TimerSynced({
								...status.lastLog,
								duration: status.duration
							})
						);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this._external
			.pipe(
				distinctUntilChange(),
				tap((synced: ITimerSynced) => (this._timeTrackerService.timerSynced = synced)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public get icon$(): Observable<any> {
		return this._icon$.asObservable();
	}

	private get _status(): Promise<ITimerStatus> {
		const { tenantId, organizationId } = this._timeTrackerService.timerConfig;
		return this._timeTrackerService.getTimerStatus({
			tenantId,
			organizationId
		});
	}
	@Output()
	public get external(): EventEmitter<ITimerSynced> {
		return this._external;
	}
}
