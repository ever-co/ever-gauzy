import { Knex } from 'knex';
import { metaData } from '../desktop-wakatime';
import {
	ActivityWatchAfkService,
	ActivityWatchChromeService,
	ActivityWatchEdgeService,
	ActivityWatchEventTableList,
	ActivityWatchFirefoxService,
	ActivityWatchWindowService
} from '../integrations';
import { IDesktopEvent, IOfflineMode } from '../interfaces';
import { Timer, TimerService } from '../offline';

/** Timer jobs, besides the ActivityWatch event tables (`ActivityWatchEventTableList`) whose jobs save events. */
export enum TimerQueueJobType {
	UPDATE_DURATION = 'update-duration-timer',
	UPDATE_TIME_SLOT = 'update-timer-time-slot',
	REMOVE_WINDOW_EVENTS = 'remove-window-events',
	REMOVE_WAKATIME_EVENTS = 'remove-wakatime-events'
}

/** A job of the desktop timer queue: `{ type, data }`, as passed to `TimerHandler.processWithQueue`. */
export interface ITimerQueueJob {
	type: string;
	data?: any;
}

export interface IDurationJobData {
	id: number;
	duration: number;
	/**
	 * Offline mode when the job was queued. Set by the persistent queue, which may run the job much later (after a
	 * restart, for instance); the in-memory queue runs it right away and leaves it out.
	 */
	offline?: boolean;
}

type TEventService = { save(events: IDesktopEvent | IDesktopEvent[]): Promise<void> };

const EVENT_SERVICES: Record<ActivityWatchEventTableList, new () => TEventService> = {
	[ActivityWatchEventTableList.WINDOW]: ActivityWatchWindowService,
	[ActivityWatchEventTableList.AFK]: ActivityWatchAfkService,
	[ActivityWatchEventTableList.CHROME]: ActivityWatchChromeService,
	[ActivityWatchEventTableList.FIREFOX]: ActivityWatchFirefoxService,
	[ActivityWatchEventTableList.EDGE]: ActivityWatchEdgeService
};

/**
 * Applies one timer queue job to the local database. Shared by the in-memory queue (the default) and the persistent
 * one (`asyncTimerDataSync`), so both write exactly the same thing. Every job is idempotent — the persistent queue may
 * run a job again after a crash. Failures are thrown to the caller.
 */
export class TimerQueueProcessor {
	constructor(private readonly timerService: TimerService, private readonly offlineMode: IOfflineMode) {}

	public async process(job: ITimerQueueJob, knex: Knex): Promise<void> {
		const type = job?.type;
		const EventService = EVENT_SERVICES[type as ActivityWatchEventTableList];
		if (EventService) {
			console.log(`Processing ${type} event`);
			return new EventService().save(job.data);
		}

		switch (type) {
			case TimerQueueJobType.REMOVE_WINDOW_EVENTS:
				console.log('Removing Window Events');
				return new ActivityWatchWindowService().clear();

			case TimerQueueJobType.REMOVE_WAKATIME_EVENTS:
				console.log('Removing Wakatime Events');
				await metaData.removeActivity(knex, { idsWakatime: job.data });
				return;

			case TimerQueueJobType.UPDATE_DURATION:
				return this.updateDuration(job.data);

			case TimerQueueJobType.UPDATE_TIME_SLOT:
				return this.timerService.update(
					new Timer({
						id: job.data.id,
						timeslotId: job.data.timeSlotId,
						timesheetId: job.data.timeSheetId
					})
				);

			default:
				console.log('Unknown Job Type');
		}
	}

	private updateDuration({ id, duration, offline }: IDurationJobData): Promise<void> {
		// A duration update only ever marks the timer unsynced while offline, so that offline sync pushes it later.
		// It never touches `synced` while online: marking an online session unsynced would push it a second time.
		const markUnsynced = typeof offline === 'boolean' ? offline : this.offlineMode.enabled;
		return this.timerService.update(new Timer({ id, duration, ...(markUnsynced ? { synced: false } : {}) }));
	}
}
