// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { In } from 'typeorm';
import { Activity, Screenshot, TimeSlot } from '../../../../core/entities/internal';
import { MultiORMEnum } from '../../../../core/utils';
import { TimeSlotMergeHandler } from './time-slot-merge.handler';

/**
 * Under MikroORM the merge persisted a detached copy of the group's first slot: it carried that slot's id
 * without being managed, so MikroORM inserted it again (duplicate key) or refused its serialized time logs,
 * and adding manual time or stopping the web timer failed. The kept slot is now loaded and updated in place.
 * The entity manager is mocked: these specs check the calls the handler makes, not a real MikroORM flush.
 */
describe('TimeSlotMergeHandler on MikroORM', () => {
	const scope = { tenantId: 'tenant-1', organizationId: 'org-1', employeeId: 'employee-1' };
	const slot = (id: string, values: Record<string, unknown>) => ({
		id,
		...scope,
		startedAt: new Date('2026-10-12T10:00:00.000Z'),
		screenshots: [],
		activities: [],
		timeLogs: [],
		...values
	});

	const setup = () => {
		const kept = { id: 'slot-1' };
		const em = {
			findOneOrFail: jest.fn(async () => kept),
			assign: jest.fn(),
			nativeUpdate: jest.fn(async () => 1),
			flush: jest.fn(async () => undefined),
			populate: jest.fn(async () => kept)
		};
		const mikroOrmTimeSlotRepository = { getEntityManager: () => em, persistAndFlush: jest.fn() };
		const handler = new TimeSlotMergeHandler(
			{ save: jest.fn() } as never,
			mikroOrmTimeSlotRepository as never,
			{ execute: jest.fn() } as never
		);
		Object.assign(handler, { ormType: MultiORMEnum.MikroORM });
		const createNewTimeSlot = (slots: unknown[]): Promise<TimeSlot> =>
			(handler as any).createNewTimeSlot(
				slots,
				'2026-10-12 10:00:00',
				scope.tenantId,
				scope.organizationId,
				scope.employeeId
			);
		return { em, kept, mikroOrmTimeSlotRepository, createNewTimeSlot };
	};

	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it('updates the kept slot in place and moves the other slots’ screenshots and activities onto it', async () => {
		const { em, kept, mikroOrmTimeSlotRepository, createNewTimeSlot } = setup();

		const merged = await createNewTimeSlot([
			slot('slot-1', {
				duration: 300,
				keyboard: 10,
				mouse: 20,
				overall: 30,
				timeLogs: [{ id: 'log-1' }],
				screenshots: [{ id: 'shot-1', timeSlotId: 'slot-1' }]
			}),
			slot('slot-2', {
				duration: 200,
				keyboard: 0,
				mouse: 5,
				overall: 15,
				timeLogs: [{ id: 'log-1' }, { id: 'log-2' }],
				screenshots: [{ id: 'shot-2', timeSlotId: 'slot-2' }],
				activities: [{ id: 'activity-2', timeSlotId: 'slot-2' }]
			}),
			slot('slot-3', { duration: 50, keyboard: 0, mouse: 0, overall: 0 })
		]);

		// No detached copy is persisted
		expect(mikroOrmTimeSlotRepository.persistAndFlush).not.toHaveBeenCalled();
		// The kept slot is read inside the caller's tenant, organization and employee
		expect(em.findOneOrFail).toHaveBeenCalledWith(
			TimeSlot,
			{ id: 'slot-1', ...scope },
			{ populate: ['timeLogs'] }
		);
		// It takes the aggregated values, and the time logs by id (each one once)
		expect(em.assign).toHaveBeenCalledWith(kept, {
			duration: 550,
			keyboard: 10,
			mouse: 25,
			overall: 45,
			startedAt: expect.any(Date),
			timeLogs: ['log-1', 'log-2']
		});
		// The children of the other slots move onto the kept one
		expect(em.nativeUpdate).toHaveBeenCalledWith(
			Screenshot,
			{ timeSlot: { $in: ['slot-2', 'slot-3'] } },
			{ timeSlot: 'slot-1' }
		);
		expect(em.nativeUpdate).toHaveBeenCalledWith(
			Activity,
			{ timeSlot: { $in: ['slot-2', 'slot-3'] } },
			{ timeSlot: 'slot-1' }
		);
		expect(em.flush).toHaveBeenCalledTimes(1);
		// The kept slot's loaded collections are refreshed after the flush, so a later read sees the moved children
		expect(em.populate).toHaveBeenCalledWith(kept, ['screenshots', 'activities'], { refresh: true });
		expect(em.populate.mock.invocationCallOrder[0]).toBeGreaterThan(em.flush.mock.invocationCallOrder[0]);
		// The merged slot handed back keeps the kept slot's id
		expect(merged.id).toBe('slot-1');
	});

	it('a group of one slot is updated without moving any child', async () => {
		const { em, kept, createNewTimeSlot } = setup();

		await createNewTimeSlot([slot('slot-1', { duration: 600, keyboard: 1, mouse: 1, overall: 1 })]);

		expect(em.assign).toHaveBeenCalledWith(kept, expect.objectContaining({ duration: 600 }));
		expect(em.nativeUpdate).not.toHaveBeenCalled();
		expect(em.populate).not.toHaveBeenCalled();
		expect(em.flush).toHaveBeenCalledTimes(1);
	});
});

/**
 * Under TypeORM the merged slot was saved with the group's screenshots and activities on it, and the relations'
 * cascade moved them one `UPDATE ... WHERE id = ?` at a time, each child read back first to be diffed: 118,938
 * such updates a month on production, inside the tracker's time-slot request. The kept slot is still saved (its
 * aggregated values, its time logs); the children of the other slots move in one statement per table, as they
 * already did under MikroORM. The repository is mocked: these specs check the calls the handler makes.
 */
describe('TimeSlotMergeHandler on TypeORM', () => {
	const scope = { tenantId: 'tenant-1', organizationId: 'org-1', employeeId: 'employee-1' };
	const slot = (id: string, values: Record<string, unknown>) => ({
		id,
		...scope,
		startedAt: new Date('2026-10-12T10:00:00.000Z'),
		screenshots: [],
		activities: [],
		timeLogs: [],
		...values
	});

	/** An update query builder that records what it is asked to do. */
	function updateBuilder(executed: Array<{ target: unknown; set: unknown; where: unknown }>) {
		const call: { target?: unknown; set?: unknown; where?: unknown } = {};
		const builder: any = {
			update: jest.fn((target: unknown) => ((call.target = target), builder)),
			set: jest.fn((values: unknown) => ((call.set = values), builder)),
			where: jest.fn((condition: unknown) => ((call.where = condition), builder)),
			execute: jest.fn(async () => {
				executed.push({ target: call.target, set: call.set, where: call.where });
				return { affected: 1 };
			})
		};
		return builder;
	}

	const setup = () => {
		const executed: Array<{ target: unknown; set: unknown; where: unknown }> = [];
		const typeOrmTimeSlotRepository = {
			save: jest.fn(async (entity: any) => ({ ...entity })),
			manager: { createQueryBuilder: jest.fn(() => updateBuilder(executed)) }
		};
		const handler = new TimeSlotMergeHandler(
			typeOrmTimeSlotRepository as never,
			{ getEntityManager: jest.fn() } as never,
			{ execute: jest.fn() } as never
		);
		Object.assign(handler, { ormType: MultiORMEnum.TypeORM });
		const createNewTimeSlot = (slots: unknown[]): Promise<TimeSlot> =>
			(handler as any).createNewTimeSlot(
				slots,
				'2026-10-12 10:00:00',
				scope.tenantId,
				scope.organizationId,
				scope.employeeId
			);
		return { executed, typeOrmTimeSlotRepository, createNewTimeSlot };
	};

	it('saves the kept slot without its children and moves the other slots’ screenshots and activities in one statement each', async () => {
		const { executed, typeOrmTimeSlotRepository, createNewTimeSlot } = setup();

		const merged = await createNewTimeSlot([
			slot('slot-1', {
				duration: 300,
				keyboard: 10,
				mouse: 20,
				overall: 30,
				timeLogs: [{ id: 'log-1', timesheetId: 'sheet-1' }],
				screenshots: [{ id: 'shot-1', timeSlotId: 'slot-1' }]
			}),
			slot('slot-2', {
				duration: 200,
				keyboard: 0,
				mouse: 5,
				overall: 15,
				timeLogs: [{ id: 'log-1', timesheetId: 'sheet-1' }, { id: 'log-2', timesheetId: 'sheet-1' }],
				screenshots: [{ id: 'shot-2', timeSlotId: 'slot-2' }],
				activities: [{ id: 'activity-2', timeSlotId: 'slot-2' }]
			}),
			slot('slot-3', { duration: 50, keyboard: 0, mouse: 0, overall: 0 })
		]);

		// The kept slot is saved with the aggregated values and the time logs (each one once) — and WITHOUT the
		// screenshots and activities, which the cascade would have written one by one.
		expect(typeOrmTimeSlotRepository.save).toHaveBeenCalledTimes(1);
		const [saved] = typeOrmTimeSlotRepository.save.mock.calls[0];
		expect(saved).toMatchObject({ id: 'slot-1', duration: 550, keyboard: 10, mouse: 25, overall: 45, ...scope });
		expect(saved.timeLogs.map((log: any) => log.id)).toEqual(['log-1', 'log-2']);
		expect(saved).not.toHaveProperty('screenshots');
		expect(saved).not.toHaveProperty('activities');

		// One UPDATE per table, over the merged slots' ids, onto the kept slot
		expect(executed).toEqual([
			{ target: Screenshot, set: { timeSlotId: 'slot-1' }, where: { timeSlotId: In(['slot-2', 'slot-3']) } },
			{ target: Activity, set: { timeSlotId: 'slot-1' }, where: { timeSlotId: In(['slot-2', 'slot-3']) } }
		]);
		// They move after the slot is saved
		expect(typeOrmTimeSlotRepository.manager.createQueryBuilder.mock.invocationCallOrder[0]).toBeGreaterThan(
			typeOrmTimeSlotRepository.save.mock.invocationCallOrder[0]
		);

		// The merged slot handed back keeps the kept slot's id and lists the moved children, as before
		expect(merged.id).toBe('slot-1');
		expect(merged.screenshots.map((shot: any) => shot.id)).toEqual(['shot-1', 'shot-2']);
		expect(merged.activities.map((activity: any) => activity.id)).toEqual(['activity-2']);
	});

	it('a group of one slot is saved without moving any child', async () => {
		const { executed, typeOrmTimeSlotRepository, createNewTimeSlot } = setup();

		await createNewTimeSlot([slot('slot-1', { duration: 600, keyboard: 1, mouse: 1, overall: 1 })]);

		expect(typeOrmTimeSlotRepository.save).toHaveBeenCalledTimes(1);
		expect(executed).toEqual([]);
		expect(typeOrmTimeSlotRepository.manager.createQueryBuilder).not.toHaveBeenCalled();
	});

	it('recalculates each timesheet of the merged slot once', async () => {
		const commandBus = { execute: jest.fn() };
		const handler = new TimeSlotMergeHandler({} as never, {} as never, commandBus as never);

		await (handler as any).updateTimeLogAndEmployeeTotalWorkedHours({
			employeeId: 'employee-1',
			timeLogs: [
				{ id: 'log-1', timesheetId: 'sheet-1' },
				{ id: 'log-2', timesheetId: 'sheet-1' },
				{ id: 'log-3', timesheetId: 'sheet-2' },
				{ id: 'log-4', timesheetId: null }
			]
		});

		const timesheetIds = commandBus.execute.mock.calls
			.map(([command]) => command)
			.filter((command) => command.constructor.name === 'TimesheetRecalculateCommand')
			.map((command) => command.id);
		expect(timesheetIds).toEqual(['sheet-1', 'sheet-2']);
		expect(
			commandBus.execute.mock.calls.filter(
				([command]) => command.constructor.name === 'UpdateEmployeeTotalWorkedHoursCommand'
			)
		).toHaveLength(1);
	});
});
