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
	REMOVE_WAKATIME_EVENTS = 'remove-wakatime-events',
	/**
	 * Empties ActivityWatch event tables (`data.tables`, all five when absent). Queued only by the persistent queue, so
	 * that a reset runs after the event saves queued before it: run directly, a save still waiting in the queue would
	 * be written after the reset and land in the next time slot.
	 */
	CLEAR_ACTIVITY_EVENTS = 'clear-activity-events'
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
	 * Whether the update marks the timer unsynced. Left out by the in-memory queue, which runs the job right away:
	 * the timer is marked when offline mode is on at that moment. The persistent queue sets it to `false` and marks
	 * the timer itself when it queues the job (`markTimerUnsynced`), because a stored job may run much later — after
	 * offline sync has uploaded the timer — and marking it then would have it uploaded a second time.
	 */
	markUnsynced?: boolean;
}

type TEventService = { save(events: IDesktopEvent | IDesktopEvent[]): Promise<void>; clear(): Promise<void> };

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

			case TimerQueueJobType.CLEAR_ACTIVITY_EVENTS:
				return this.clearActivityEvents(job.data?.tables);

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

	/**
	 * Marks a timer tracked offline as unsynced, so that offline sync uploads it once back online — what a duration
	 * update does on the in-memory queue while offline.
	 */
	public markTimerUnsynced(id: number): Promise<void> {
		return this.timerService.update(new Timer({ id, synced: false }));
	}

	/** Empties the named event tables (all five when none is named). Throws when one could not be emptied, so the job is retried. */
	private async clearActivityEvents(tables?: ActivityWatchEventTableList[]): Promise<void> {
		const names = tables?.length ? tables : (Object.keys(EVENT_SERVICES) as ActivityWatchEventTableList[]);
		const results = await Promise.allSettled(
			names.filter((name) => EVENT_SERVICES[name]).map((name) => new EVENT_SERVICES[name]().clear())
		);
		const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
		if (failed) {
			throw failed.reason;
		}
	}

	private updateDuration({ id, duration, markUnsynced }: IDurationJobData): Promise<void> {
		// Never touches `synced` while online: marking an online session unsynced would push it a second time.
		const unsynced = typeof markUnsynced === 'boolean' ? markUnsynced : this.offlineMode.enabled;
		return this.timerService.update(new Timer({ id, duration, ...(unsynced ? { synced: false } : {}) }));
	}
}
