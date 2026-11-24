import { ICommand } from '@nestjs/cqrs';
import type { EntityManager } from 'typeorm';
import { ID, ITimeLog } from '@gauzy/contracts';
import { TimeLog } from './../time-log.entity';
import type { TimeLogHistoryOptions } from '../time-log-history.writer';

/**
 * What an update writes besides the entry's columns, and checks before it writes anything, in the transaction that
 * locks the entry and writes it. Either one runs the update in that transaction.
 */
export interface TimeLogUpdateOptions {
	/**
	 * The tags the update files the entry under (ever-co/ever-gauzy#12029), already checked (`timeLogTagsOf`): written
	 * in the update's transaction, so an update refused there writes none, and a change of the tags saved meanwhile is
	 * never replaced after the check. Left out, the entry keeps its tags.
	 */
	tagIds?: ID[];
	/**
	 * A check of the entry as read under its lock, run in the update's transaction before anything is written: what it
	 * throws refuses the update, nothing written. A change that depends on more than the entry's own row (a split, on its
	 * timesheet) reads that row in the same transaction, under the lock the writes of that row take.
	 */
	assertBeforeWrite?: (manager: EntityManager, current: ITimeLog) => Promise<void>;
}

export class TimeLogUpdateCommand implements ICommand {
	static readonly type = '[Time Tracking] Time Log update';

	/**
	 * @param history Given by the routes through which a person edits an entry: records the change in its history.
	 * @param stopsRun Given by the timer when it stops a run it read as running (a stop, the end of a run another start
	 * replaces): the update writes only while the row still runs, whatever the handler reads of it later. A row stopped
	 * since by another start or stop refuses it (ever-co/ever-gauzy#11826). Ordinary edits leave it unset.
	 * @param options What the update writes besides the entry's columns, and checks before writing, in its transaction
	 * (see `TimeLogUpdateOptions`).
	 */
	constructor(
		public readonly input: Partial<TimeLog>,
		public readonly id: ID | TimeLog,
		public readonly manualTimeSlot?: boolean | null,
		public readonly forceDelete: boolean = false,
		public readonly history?: TimeLogHistoryOptions,
		public readonly stopsRun: boolean = false,
		public readonly options: TimeLogUpdateOptions = {}
	) {}
}
