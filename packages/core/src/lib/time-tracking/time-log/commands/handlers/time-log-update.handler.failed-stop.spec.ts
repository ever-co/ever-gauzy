// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { ID, ITimeSlot, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { RequestContext } from '../../../../core/context';
import { MultiORMEnum } from '../../../../core/utils';
import { TimesheetFirstOrCreateCommand } from '../../../timesheet/commands';
import { TimeSlotBulkDeleteCommand } from '../../../time-slot/commands';
import { generateTimeSlots } from '../../../time-slot/utils';
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
function createRun(source: TimeLogSourceEnum) {
	const run = {
		id: RUN,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		source,
		logType: TimeLogType.TRACKED,
		startedAt: at('09:00'),
		stoppedAt: at('09:00'),
		isRunning: true
	};
	const slots: IStoredSlot[] = [];
	const hardDeleted: string[] = [];
	let created = 0;

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
	const slotEntity = (slot: IStoredSlot) =>
		({
			id: slot.id,
			startedAt: new Date(slot.startedAt),
			timeLogs: slot.timeLogIds.map((id) => ({ id }))
		}) as unknown as ITimeSlot;
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
		update: jest.fn(async (_where: object, changes: object) => {
			failIfDue('stopWrite');
			Object.assign(run, changes);
			return { affected: 1 };
		})
	};

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
				const exists = slotsAt([new Date(slot.startedAt)]).length > 0;
				if (!exists) {
					slots.push({
						id: `slot-${++created}`,
						startedAt: new Date(slot.startedAt),
						timeLogIds: [slot.timeLogId]
					});
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

	const handler = new TimeLogUpdateHandler(
		commandBus as any,
		timeLogRepository as any,
		timeSlotRepository as any,
		{} as any,
		timeSlotService as any
	);
	Object.defineProperty(handler, 'ormType', { value: MultiORMEnum.TypeORM });
	// The slots of the employee at the given starts, with their logs (the lookup is read on both ORMs elsewhere)
	jest.spyOn(handler as any, 'findTimeSlots').mockImplementation(async (...args: unknown[]) =>
		slotsAt(args[3] as Date[]).map(slotEntity)
	);
	// The save of the log read back: its columns, and its `timeSlots` as its join rows
	jest.spyOn(handler as any, 'saveUpdatedTimeLog').mockImplementation(async (log: any) => {
		failIfDue('save');
		const linked = new Set((log.timeSlots ?? []).map((slot: ITimeSlot) => slot.id));
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
		/** The stop the timer sends, at `time`; the error it raised, if any. */
		stop: (time: string) =>
			handler.execute(new TimeLogUpdateCommand({ isRunning: false, stoppedAt: at(time) }, RUN)).then(
				() => undefined,
				(error: Error) => error.message
			),
		/** Another log of the employee holds a slot at `time`, as two logs meeting inside one ten-minute slot do. */
		addSlotOfAnotherLog(time: string) {
			slots.push({ id: `shared@${time}`, startedAt: at(time), timeLogIds: [OTHER_LOG] });
		},
		/** The run as stored, with the starts of the slots it holds. */
		state: () => ({
			isRunning: run.isRunning,
			stoppedAt: hhmm(run.stoppedAt),
			slots: heldBy(RUN).map((slot) => hhmm(slot.startedAt))
		}),
		slotsOf: (logId: string) => heldBy(logId).map((slot) => hhmm(slot.startedAt)),
		slotCount: () => slots.length,
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

	it('leaves the run stopped with every slot of its range when the save after the stop fails', async () => {
		const store = createRun(source);
		store.fail('save');

		const outcome = await store.stop('09:30');

		expect(store.state()).toEqual({ isRunning: false, stoppedAt: '09:30', slots: slotStarts('09:00', '09:30') });
		expect(outcome).toBe('The save failed');
	});
});
