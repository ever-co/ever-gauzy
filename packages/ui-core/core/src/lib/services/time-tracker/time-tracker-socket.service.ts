import { Injectable } from '@angular/core';
import { BehaviorSubject, fromEvent, tap } from 'rxjs';
import { ITimerStatusWithWeeklyLimits } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { SocketConnectionService } from '../socket-connection/socket-connection.service';
import { TimeTrackerService } from './time-tracker.service';

@UntilDestroy()
@Injectable({
	providedIn: 'root'
})
export class TimeTrackerSocketService {
	private isFetchingStatus = false;
	public timerSocketStatus$ = new BehaviorSubject<ITimerStatusWithWeeklyLimits>(null);

	constructor(
		private readonly socketConnection: SocketConnectionService,
		private readonly timeTrackerService: TimeTrackerService
	) {
		this.listenToTimerChanges();
	}

	/**
	 * Listen to timer events from the socket connection
	 */
	private listenToTimerChanges(): void {
		console.log(this.socketConnection?.socket);
		if (this.socketConnection?.socket)
			fromEvent(this.socketConnection.socket, 'timer:changed')
				.pipe(
					untilDestroyed(this),
					tap(() => this.fetchTimerStatus())
				)
				.subscribe();
	}

	/**
	 * Fetch the latest timer status from backend
	 * Prevents duplicate fetches using isFetchingStatus
	 */
	private fetchTimerStatus(): void {
		if (this.isFetchingStatus) return;
		this.isFetchingStatus = true;

		const { tenantId, organizationId } = this.timeTrackerService.timerConfig;
		const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		this.timeTrackerService
			.checkTimerStatus({
				tenantId,
				organizationId,
				relations: ['employee'],
				timeZone
			})
			.then((status) => this.timerSocketStatus$.next(status))
			.finally(() => (this.isFetchingStatus = false));
	}
}
