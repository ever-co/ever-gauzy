// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

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
