// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { ID, ITimeSlot, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { RequestContext } from '../../../../core/context';
import { MultiORMEnum } from '../../../../core/utils';
import { TimesheetFirstOrCreateCommand, TimesheetRecalculateCommand } from '../../../timesheet/commands';
import { TimeSlotBulkDeleteCommand } from '../../../time-slot/commands';
import { generateTimeSlots } from '../../../time-slot/utils';
import { TimeLog } from '../../time-log.entity';
import { TimeLogUpdateCommand } from '../time-log-update.command';
import { TimeLogUpdateHandler } from './time-log-update.handler';

/**
 * ever-co/ever-gauzy#11889: the stop of a run that takes the slots of its range (a web timer run, or an Ever Teams or
 * mobile run that posted none) wrote the stop, then inserted those slots. When the insert failed, the run stayed
 * stopped without slots, out of the day's worked time, and a stop sent again was refused as already stopped. A stop
 * now leaves the run either still running with nothing written, or stopped with every slot of its range.
 */

const TENANT = 'tenant-a';
const ORGANIZATION = 'org-a';
const EMPLOYEE = 'employee-a';
const RUN = 'run';
const OTHER_LOG = 'other-log';
const TIMESHEET = 'timesheet-0';

/** 2026-01-05 at `HH:mm`, UTC. */
const at = (time: string) => new Date(`2026-01-05T${time}:00.000Z`);
/** The `HH:mm` of a date, UTC. */
const hhmm = (date: Date) => date.toISOString().slice(11, 16);
/** The start of each ten-minute slot of `start`–`stop`. */
const slotStarts = (start: string, stop: string) =>
	generateTimeSlots(at(start), at(stop)).map((slot) => hhmm(new Date(slot.startedAt)));

/** The writes a spec can make fail, in the order a stop used to make them or makes them now. */
type Write = 'stopWrite' | 'slotInsert' | 'slotMerge' | 'link' | 'save';

interface IStoredSlot {
	id: string;
	startedAt: Date;
	/** The logs holding the slot (its join rows). */
	timeLogIds: string[];
}

/** A run of `source` started at 09:00, still running, over a store of the employee's slots. */
function createRun(source: TimeLogSourceEnum, { factsWithinWrites = false } = {}) {
	const run = {
		id: RUN,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		timesheetId: TIMESHEET,
		source,
		logType: TimeLogType.TRACKED,
		startedAt: at('09:00'),
		stoppedAt: at('09:00'),
		isRunning: true
	};
	/** The run as a stop read it before its first try. */
	const firstRead = { ...run };
	const slots: IStoredSlot[] = [];
	const hardDeleted: string[] = [];
	let created = 0;
	/** What another write of the run stores just before this one fails (see `stopElsewhereFirst`). */
	let landsFirst: Partial<typeof run> | undefined;
	/** What another stop of the run stores just before this one writes, without failing it (see `stopElsewhereBeforeWrite`). */
	let stoppedBeforeWrite: Partial<typeof run> | undefined;
	/** The start another call moves the run to just before this one writes (see `moveStartElsewhereBeforeWrite`). */
	let movedBeforeWrite: Date | undefined;
	/** Whether the insert's merge folds the slots sharing a start into the first one, as `TimeSlotMergeHandler` does. */
	let mergesSlotsSharingAStart = false;
	/** Whether the insert finds an existing slot by its exact start, as `TimeSlotBulkCreateHandler` does, or by minute. */
	let insertsByExactStart = false;
	/** Whether every read answers the same instance of a slot, updated in place, as MikroORM's identity map does. */
	let keepsOneInstancePerSlot = false;
	const instances = new Map<string, { id: string; startedAt: Date; timeLogs: Array<{ id: string }> }>();

	const failing: Partial<Record<Write, number>> = {};
	const failIfDue = (write: Write) => {
		const times = failing[write] ?? 0;
		if (times > 0) {
			failing[write] = times - 1;
			throw new Error(`The ${write} failed`);
		}
	};

	const heldBy = (logId: string) =>
		slots
			.filter((slot) => slot.timeLogIds.includes(logId))
			.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
	/** A slot as a lookup with its logs answers it. */
	const slotEntity = (slot: IStoredSlot) => {
		const read = {
			id: slot.id,
			startedAt: new Date(slot.startedAt),
			timeLogs: slot.timeLogIds.map((id) => ({ id }))
		};
		if (!keepsOneInstancePerSlot) {
			return read as unknown as ITimeSlot;
		}
		// The instance an earlier read answered, now holding what this read found
		const instance = instances.get(slot.id) ?? read;
		instances.set(slot.id, Object.assign(instance, read));
		return instance as unknown as ITimeSlot;
	};
	/** The slots starting within the minutes of the given starts. */
	const slotsAt = (starts: Date[]) =>
		slots.filter((slot) =>
			starts.some((start) => {
				const from = new Date(start).setSeconds(0, 0);
				return slot.startedAt.getTime() >= from && slot.startedAt.getTime() < from + 60_000;
			})
		);

	const timeLogRepository = {
		findOneBy: jest.fn(async () => ({ ...run })),
		update: jest.fn(async (where: { isRunning?: boolean; startedAt?: Date }, changes: object) => {
			if (landsFirst) {
				Object.assign(run, landsFirst);
				landsFirst = undefined;
				throw new Error('The stopWrite failed');
			}
			if (stoppedBeforeWrite) {
				Object.assign(run, stoppedBeforeWrite);
				stoppedBeforeWrite = undefined;
			}
			if (movedBeforeWrite) {
				run.startedAt = movedBeforeWrite;
				movedBeforeWrite = undefined;
			}
			failIfDue('stopWrite');
			// A write that asks for a running row matches no row once the run is stopped
			if (where?.isRunning === true && !run.isRunning) {
				return { affected: 0 };
			}
			// Nor one that asks for the start the run had once it starts elsewhere
			if (where?.startedAt != null && new Date(where.startedAt).getTime() !== run.startedAt.getTime()) {
				return { affected: 0 };
			}
			Object.assign(run, changes);
			return { affected: 1 };
		})
	};

	// The transaction a write runs in when its fact goes in it, on the same rows
	const writeTransaction = { getRepository: () => timeLogRepository };
	if (factsWithinWrites) {
		Object.assign(timeLogRepository, {
			manager: { transaction: async (work: (manager: unknown) => unknown) => work(writeTransaction) }
		});
	}

	// The count of a log's slots (`hasTimeSlots`), and the join-row writes of `relation(TimeSlot, 'timeLogs')`
	const timeSlotRepository = {
		createQueryBuilder: jest.fn(() => {
			const builder = {
				alias: 'time_slot',
				innerJoin: () => builder,
				where: () => builder,
				getCount: async () => heldBy(RUN).length,
				relation: () => ({
					of: (ids: ID | ID[]) => {
						const related = slots.filter((slot) => [].concat(ids).includes(slot.id));
						return {
							add: async (logId: string) => {
								failIfDue('link');
								related.forEach((slot) => (slot.timeLogIds = [...slot.timeLogIds, logId]));
							},
							remove: async (logId: string) => {
								related.forEach(
									(slot) => (slot.timeLogIds = slot.timeLogIds.filter((id) => id !== logId))
								);
							}
						};
					}
				})
			};
			return builder;
		})
	};

	// `TimeSlotBulkCreateHandler`: inserts the slots of the starts the employee has none at, linked to the log, in one
	// save, then merges the employee's slots over that span, and answers every slot at those starts
	const timeSlotService = {
		generateTimeSlots,
		bulkCreate: jest.fn(async (requested: Array<{ startedAt: Date; timeLogId: string }>) => {
			failIfDue('slotInsert');
			const starts = requested.map((slot) => new Date(slot.startedAt));
			for (const slot of requested) {
				const start = new Date(slot.startedAt);
				const exists = insertsByExactStart
					? slots.some((stored) => stored.startedAt.getTime() === start.getTime())
					: slotsAt([start]).length > 0;
				if (!exists) {
					slots.push({
						id: `slot-${++created}`,
						startedAt: new Date(slot.startedAt),
						timeLogIds: [slot.timeLogId]
					});
				}
			}
			if (mergesSlotsSharingAStart) {
				// One slot per start, the first stored: it takes the logs of the others, which go
				for (const start of starts) {
					const [kept, ...others] = slotsAt([start]);
					for (const other of others) {
						kept.timeLogIds = [...new Set([...kept.timeLogIds, ...other.timeLogIds])];
						slots.splice(slots.indexOf(other), 1);
					}
				}
			}
			failIfDue('slotMerge');
			return slotsAt(starts).map(slotEntity);
		})
	};

	const commandBus = {
		execute: jest.fn(async (command: unknown) => {
			if (command instanceof TimesheetFirstOrCreateCommand) return { id: 'timesheet-1' };
			if (command instanceof TimeSlotBulkDeleteCommand) {
				const ids: string[] = command.input.timeSlotsIds;
				for (const id of ids) {
					slots.splice(
						slots.findIndex((slot) => slot.id === id),
						1
					);
					hardDeleted.push(id);
				}
				return [];
			}
			return undefined;
		})
	};

	// The time entry facts the handler writes for the webhooks, by name, and whether each went in its write's transaction
	const facts: string[] = [];
	const factsInWrite: boolean[] = [];
	const factsService = {
		appendsWithinWrites: () => factsWithinWrites,
		record: async (name: string) => {
			facts.push(name);
			factsInWrite.push(false);
		},
		recordWithin: async (manager: unknown, name: string) => {
			facts.push(name);
			factsInWrite.push(manager === writeTransaction);
		}
	};
	const handler = new TimeLogUpdateHandler(
		commandBus as any,
		timeLogRepository as any,
		timeSlotRepository as any,
		{} as any,
		timeSlotService as any,
		undefined,
		factsService as any
	);
	Object.defineProperty(handler, 'ormType', { value: MultiORMEnum.TypeORM });
	// The slots of the employee at the given starts, with their logs (the lookup is read on both ORMs elsewhere)
	jest.spyOn(handler as any, 'findTimeSlots').mockImplementation(async (...args: unknown[]) =>
		slotsAt(args[3] as Date[]).map(slotEntity)
	);
	// The save of the log read back: its columns, and its `timeSlots` as its join rows. A log saved without
	// `timeSlots` (read back without the relation) leaves its join rows as they are, as TypeORM's save does
	jest.spyOn(handler as any, 'saveUpdatedTimeLog').mockImplementation(async (log: any) => {
		failIfDue('save');
		if (log.timeSlots === undefined) {
			return log;
		}
		const linked = new Set((log.timeSlots as ITimeSlot[]).map((slot: ITimeSlot) => slot.id));
		for (const slot of slots) {
			const others = slot.timeLogIds.filter((id) => id !== RUN);
			slot.timeLogIds = linked.has(slot.id) ? [...others, RUN] : others;
		}
		return log;
	});

	return {
		run,
		/** Makes a write fail its next `times` calls. */
		fail(write: Write, times = 1) {
			failing[write] = times;
		},
		/** The stop the timer sends, at `time` (`stopsRun`); the error it raised, if any. */
		stop: (time: string) =>
			handler
				.execute(
					new TimeLogUpdateCommand(
						{ isRunning: false, stoppedAt: at(time) },
						RUN,
						undefined,
						false,
						undefined,
						true
					)
				)
				.then(
					() => undefined,
					(error: Error) => error.message
				),
		/**
		 * The same stop sent with the run as it was read before a first try, running, and its start, as
		 * `TimerService.stopReplacedRun` sends its second try; the error it raised, if any.
		 */
		stopAsFirstRead: (time: string) =>
			handler
				.execute(
					new TimeLogUpdateCommand(
						{ isRunning: false, startedAt: firstRead.startedAt, stoppedAt: at(time) },
						new TimeLog({ ...firstRead }),
						undefined,
						false,
						undefined,
						true
					)
				)
				.then(
					() => undefined,
					(error: Error) => error.message
				),
		/** An edit of the log's end to `time`; the error it raised, if any. */
		editEnd: (time: string) =>
			handler.execute(new TimeLogUpdateCommand({ stoppedAt: at(time) }, RUN)).then(
				() => undefined,
				(error: Error) => error.message
			),
		/**
		 * Another log of the employee holds a slot at `time` (and `ms` milliseconds, as the web timer stores them), as two
		 * logs meeting inside one ten-minute slot do.
		 */
		addSlotOfAnotherLog(time: string, ms = 0) {
			slots.push({ id: `shared@${time}`, startedAt: new Date(at(time).getTime() + ms), timeLogIds: [OTHER_LOG] });
		},
		/** The insert finds an existing slot by its exact start, as `TimeSlotBulkCreateHandler` does. */
		insertByExactStart() {
			insertsByExactStart = true;
		},
		/** Every read answers the same instance of a slot, updated in place, as MikroORM's identity map does. */
		keepOneInstancePerSlot() {
			keepsOneInstancePerSlot = true;
		},
		/** The run holds a slot at `time`. */
		addSlotOfTheRun(time: string) {
			slots.push({ id: `own@${time}`, startedAt: at(time), timeLogIds: [RUN] });
		},
		/** The insert's merge folds the slots sharing a start into the first one stored, as it does on TypeORM. */
		mergeSlotsSharingAStart() {
			mergesSlotsSharingAStart = true;
		},
		/** Another stop of the run, at `time`, goes through just before this stop's own write fails. */
		stopElsewhereFirst(time: string) {
			landsFirst = { isRunning: false, stoppedAt: at(time) };
		},
		/**
		 * Another stop of the run, at `time`, goes through just before this stop writes: one of another API process that
		 * took the employee's timer turn over once this one outlived it.
		 */
		stopElsewhereBeforeWrite(time: string) {
			stoppedBeforeWrite = { isRunning: false, stoppedAt: at(time) };
		},
		/**
		 * Another call moves the start of the still running run to `time` just before this stop writes: the start move of
		 * another API process that took the employee's timer turn over once this one outlived it.
		 */
		moveStartElsewhereBeforeWrite(time: string) {
			movedBeforeWrite = at(time);
		},
		/** The timesheets recalculated, by id. */
		recalculated: () =>
			commandBus.execute.mock.calls
				.map(([command]) => command)
				.filter((command) => command instanceof TimesheetRecalculateCommand)
				.map((command) => (command as TimesheetRecalculateCommand).id),
		/** The run as stored, with the starts of the slots it holds. */
		state: () => ({
			isRunning: run.isRunning,
			stoppedAt: hhmm(run.stoppedAt),
			slots: heldBy(RUN).map((slot) => hhmm(slot.startedAt))
		}),
		slotsOf: (logId: string) => heldBy(logId).map((slot) => hhmm(slot.startedAt)),
		slotCount: () => slots.length,
		/** The time entry facts written, in order. */
		facts: () => [...facts],
		/** Whether each fact went in the transaction of its write. */
		factsInWrite: () => [...factsInWrite],
		hardDeleted: () => [...hardDeleted]
	};
}

/** The run as it was before the stop: running since 09:00, with no slot. */
const STILL_RUNNING = { isRunning: true, stoppedAt: '09:00', slots: [] as string[] };

describe.each([
	['a web timer run', TimeLogSourceEnum.WEB_TIMER],
	['an Ever Teams run that posted no slot', TimeLogSourceEnum.TEAMS],
	['a mobile run that posted no slot', TimeLogSourceEnum.MOBILE]
])('TimeLogUpdateHandler, the stop of %s when a write fails (#11889)', (_run, source) => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});
	afterEach(() => jest.restoreAllMocks());

	it('leaves the run running, with nothing written, and raises the error, when the slot insert fails', async () => {
		const store = createRun(source);
		store.fail('slotInsert');

		const outcome = await store.stop('09:30');

		expect(store.state()).toEqual(STILL_RUNNING);
		expect(store.slotCount()).toBe(0);
		expect(outcome).toBe('The slotInsert failed');
	});

	it('deletes the slots it inserted and leaves the run running when a later step of the insert fails', async () => {
		const store = createRun(source);
		// The slots are saved, linked to the run, then the merge of the employee's slots fails
		store.fail('slotMerge');

		const outcome = await store.stop('09:30');

		expect(store.state()).toEqual(STILL_RUNNING);
		expect(store.slotCount()).toBe(0);
		expect(store.hardDeleted()).toHaveLength(3);
		expect(outcome).toBe('The slotMerge failed');
	});

	it('leaves the run running with no slot when the stop itself cannot be written', async () => {
		const store = createRun(source);
		store.fail('stopWrite');

		const outcome = await store.stop('09:30');

		expect(store.state()).toEqual(STILL_RUNNING);
		expect(store.slotCount()).toBe(0);
		expect(outcome).toBe('The stopWrite failed');
	});

	it('takes the run off a slot another log holds, without deleting it, when the stop fails', async () => {
		const store = createRun(source);
		store.addSlotOfAnotherLog('09:10');
		store.fail('stopWrite');

		await store.stop('09:30');

		expect(store.state()).toEqual(STILL_RUNNING);
		expect(store.slotsOf(OTHER_LOG)).toEqual(['09:10']);
		expect(store.slotCount()).toBe(1);
	});

	it('leaves another log its slot, and the run running, when linking the run to that slot fails', async () => {
		const store = createRun(source);
		store.addSlotOfAnotherLog('09:10');
		store.fail('link');

		const outcome = await store.stop('09:30');

		expect(store.state()).toEqual(STILL_RUNNING);
		expect(store.slotsOf(OTHER_LOG)).toEqual(['09:10']);
		expect(store.slotCount()).toBe(1);
		expect(outcome).toBe('The link failed');
	});

	it.each(['slotInsert', 'slotMerge', 'stopWrite'] as const)(
		'stops the run with every slot of its range when a stop sent again after a failed %s goes through',
		async (write) => {
			const store = createRun(source);
			store.fail(write);
			await store.stop('09:30');

			const outcome = await store.stop('09:50');

			expect(store.state()).toEqual({
				isRunning: false,
				stoppedAt: '09:50',
				slots: slotStarts('09:00', '09:50')
			});
			expect(outcome).toBeUndefined();
		}
	);

	it('recalculates the timesheet once it has deleted the slots it inserted, which the merge counted', async () => {
		const store = createRun(source);
		store.fail('stopWrite');

		await store.stop('09:30');

		expect(store.slotCount()).toBe(0);
		expect(store.recalculated()).toEqual([TIMESHEET]);
	});

	it('recalculates nothing when the slot insert failed before writing any slot', async () => {
		const store = createRun(source);
		store.fail('slotInsert');

		await store.stop('09:30');

		expect(store.recalculated()).toEqual([]);
	});

	it('keeps the slots of the range another stop of the run wrote in the meantime, and gives back the rest', async () => {
		const store = createRun(source);
		// A stop at 09:20 (the tracking turned off, or one from another API process) goes through, then this one's
		// write of 09:30 fails: the run holds the slots of the range that stop wrote
		store.stopElsewhereFirst('09:20');

		const outcome = await store.stop('09:30');

		expect(store.state()).toEqual({ isRunning: false, stoppedAt: '09:20', slots: slotStarts('09:00', '09:20') });
		expect(store.slotCount()).toBe(2);
		expect(outcome).toBe('The stopWrite failed');
	});

	it("lets go of another log's slot the merge moved its link onto, when each read answers the same instance (MikroORM)", async () => {
		const store = createRun(source);
		// Another log's slot at 09:10:00.500: the insert, matching starts exactly, adds one at 09:10, and the merge
		// folds it into that older slot, which then holds the run too. Read again, the instance read before the write
		// says so as well.
		store.addSlotOfAnotherLog('09:10', 500);
		store.insertByExactStart();
		store.mergeSlotsSharingAStart();
		store.keepOneInstancePerSlot();
		store.fail('stopWrite');

		const outcome = await store.stop('09:30');

		expect(outcome).toBe('The stopWrite failed');
		// Left holding that slot, a run that posts heartbeat slots would count as having some, and a stop sent again
		// would not give it the slots of its range
		expect(store.state()).toEqual(STILL_RUNNING);
		expect(store.slotsOf(OTHER_LOG)).toEqual(['09:10']);
		expect(store.slotCount()).toBe(1);
	});

	it('leaves the run stopped with every slot of its range when the save after the stop fails', async () => {
		const store = createRun(source);
		store.fail('save');

		const outcome = await store.stop('09:30');

		expect(store.state()).toEqual({ isRunning: false, stoppedAt: '09:30', slots: slotStarts('09:00', '09:30') });
		expect(outcome).toBe('The save failed');
	});
});

describe('TimeLogUpdateHandler, an edit of a web timer log whose write fails after the merge of its slots (#11889)', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});
	afterEach(() => jest.restoreAllMocks());

	it('leaves the log the slot the merge moved its link onto, at a start where it held one', async () => {
		const store = createRun(TimeLogSourceEnum.WEB_TIMER);
		// A log of 09:00 to 09:20, and an older slot of another log at 09:10, beside the log's own slot there
		Object.assign(store.run, { isRunning: false, stoppedAt: at('09:20') });
		store.addSlotOfAnotherLog('09:10');
		store.addSlotOfTheRun('09:00');
		store.addSlotOfTheRun('09:10');
		// The insert's merge keeps the older slot at 09:10, with both logs, and the log's own one there goes
		store.mergeSlotsSharingAStart();
		store.fail('stopWrite');

		const outcome = await store.editEnd('09:30');

		expect(outcome).toBe('The stopWrite failed');
		expect(store.state()).toEqual({ isRunning: false, stoppedAt: '09:20', slots: ['09:00', '09:10'] });
		expect(store.slotsOf(OTHER_LOG)).toEqual(['09:10']);
		// The 09:20 slot the edit inserted is given back
		expect(store.slotCount()).toBe(2);
	});
});

describe.each([
	['a web timer run', TimeLogSourceEnum.WEB_TIMER],
	['an Ever Teams run that posted no slot', TimeLogSourceEnum.TEAMS],
	['a mobile run that posted no slot', TimeLogSourceEnum.MOBILE]
])('TimeLogUpdateHandler, the stop of %s that another start or stop stopped meanwhile (#11826)', (_run, source) => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});
	afterEach(() => jest.restoreAllMocks());

	it('leaves the end the other stop wrote, gives back the slots past it, and is refused', async () => {
		const store = createRun(source);
		store.stopElsewhereBeforeWrite('09:20');

		const outcome = await store.stop('09:30');

		// The slots of the range the other stop stored stay the run's, as that stop gave it them (#11889); the ones past
		// its end, which only this stop wanted, go
		expect(store.state()).toEqual({ isRunning: false, stoppedAt: '09:20', slots: slotStarts('09:00', '09:20') });
		expect(store.slotCount()).toBe(slotStarts('09:00', '09:20').length);
		expect(outcome).toBe('This timer was already stopped by another start or stop.');
	});

	it('is refused as well when its own read already finds the run stopped by the other stop', async () => {
		const store = createRun(source);
		// The other stop landed before this one's handler read the run
		Object.assign(store.run, { isRunning: false, stoppedAt: at('09:20') });

		const outcome = await store.stop('09:30');

		expect(store.state()).toEqual({ isRunning: false, stoppedAt: '09:20', slots: [] });
		expect(store.slotCount()).toBe(0);
		expect(outcome).toBe('This timer was already stopped by another start or stop.');
	});

	it('completes a second try of the same stop, sent with the run as first read, after its first try wrote the row', async () => {
		const store = createRun(source);
		// The first try writes the stop, then the save of the run read back fails
		store.fail('save');
		await store.stop('09:30');

		const outcome = await store.stopAsFirstRead('09:30');

		expect(outcome).toBeUndefined();
		expect(store.state()).toEqual({ isRunning: false, stoppedAt: '09:30', slots: slotStarts('09:00', '09:30') });
	});

	it('refuses the second try when an edit moved the start of the row its first try stopped', async () => {
		const store = createRun(source);
		store.fail('save');
		await store.stop('09:30');
		// An edit moves the start of the stopped entry before the second try
		Object.assign(store.run, { startedAt: at('09:10') });

		const outcome = await store.stopAsFirstRead('09:30');

		expect(outcome).toBe('This timer was already stopped by another start or stop.');
		expect(store.run.startedAt).toEqual(at('09:10'));
		expect(store.state()).toMatchObject({ isRunning: false, stoppedAt: '09:30' });
	});

	it('is refused, and leaves the run going from the moved start, when another call moved its start before the write', async () => {
		const store = createRun(source);
		store.moveStartElsewhereBeforeWrite('09:10');

		// The stop of a replaced run names the start it read (`stopReplacedRun`)
		const outcome = await store.stopAsFirstRead('09:30');

		expect(outcome).toBe('This timer was already stopped by another start or stop.');
		expect(store.run).toMatchObject({ isRunning: true, startedAt: at('09:10'), stoppedAt: at('09:00') });
	});

	it('still writes an edit of a stopped log, which is no stop of a run', async () => {
		const store = createRun(source);
		await store.stop('09:30');

		const outcome = await store.editEnd('09:40');

		expect(outcome).toBeUndefined();
		expect(store.state()).toMatchObject({ isRunning: false, stoppedAt: '09:40' });
	});
});

describe('TimeLogUpdateHandler, the time entry facts of a stop, after it on SQLite and MikroORM (ever-co/ever-gauzy#12071)', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});
	afterEach(() => jest.restoreAllMocks());

	it('writes one time_log.stopped for a stop that goes through', async () => {
		const store = createRun(TimeLogSourceEnum.WEB_TIMER);

		await store.stop('09:30');

		expect(store.facts()).toEqual(['time_log.stopped']);
	});

	it('writes none for a stop refused because another one stopped the run', async () => {
		const store = createRun(TimeLogSourceEnum.WEB_TIMER);
		store.stopElsewhereBeforeWrite('09:20');

		await store.stop('09:30');

		expect(store.facts()).toEqual([]);
	});

	it('writes none for a try that fails, and one for the try that completes the stop', async () => {
		const store = createRun(TimeLogSourceEnum.WEB_TIMER);
		store.fail('save');
		await store.stop('09:30');
		expect(store.facts()).toEqual([]);

		await store.stopAsFirstRead('09:30');

		expect(store.facts()).toEqual(['time_log.stopped']);
	});

	it('writes time_log.updated for an edit of a stopped log', async () => {
		const store = createRun(TimeLogSourceEnum.WEB_TIMER);
		await store.stop('09:30');

		await store.editEnd('09:40');

		expect(store.facts()).toEqual(['time_log.stopped', 'time_log.updated']);
	});
});

describe('TimeLogUpdateHandler, the time entry facts of a stop, in its transaction (ever-co/ever-gauzy#12071)', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});
	afterEach(() => jest.restoreAllMocks());

	const createRunWithFactsInWrites = () => createRun(TimeLogSourceEnum.WEB_TIMER, { factsWithinWrites: true });

	it('writes time_log.stopped in the transaction of the stop', async () => {
		const store = createRunWithFactsInWrites();

		await store.stop('09:30');

		expect(store.facts()).toEqual(['time_log.stopped']);
		expect(store.factsInWrite()).toEqual([true]);
	});

	it('writes none for a stop refused because another one stopped the run', async () => {
		const store = createRunWithFactsInWrites();
		store.stopElsewhereBeforeWrite('09:20');

		await store.stop('09:30');

		expect(store.facts()).toEqual([]);
	});

	it('writes none when the stop itself cannot be written, and one with the try that completes it', async () => {
		const store = createRunWithFactsInWrites();
		store.fail('stopWrite');
		await store.stop('09:30');
		expect(store.facts()).toEqual([]);

		await store.stopAsFirstRead('09:30');

		expect(store.facts()).toEqual(['time_log.stopped']);
		expect(store.factsInWrite()).toEqual([true]);
	});

	it('keeps the fact a try wrote with its stop when a later step fails, and the try that completes adds none', async () => {
		const store = createRunWithFactsInWrites();
		store.fail('save');
		await store.stop('09:30');
		expect(store.state().isRunning).toBe(false);
		expect(store.facts()).toEqual(['time_log.stopped']);

		await store.stopAsFirstRead('09:30');

		expect(store.facts()).toEqual(['time_log.stopped']);
	});

	it('writes time_log.updated for an edit of a stopped log, in its transaction', async () => {
		const store = createRunWithFactsInWrites();
		await store.stop('09:30');

		await store.editEnd('09:40');

		expect(store.facts()).toEqual(['time_log.stopped', 'time_log.updated']);
		expect(store.factsInWrite()).toEqual([true, true]);
	});
});
