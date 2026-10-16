// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { RequestContext } from '../../../../core/context';
import { MultiORMEnum } from '../../../../core/utils';
import { TimeSlotBulkDeleteCommand } from '../time-slot-bulk-delete.command';
import { TimeSlotBulkDeleteHandler } from './time-slot-bulk-delete.handler';

/**
 * The slot cleanup of a deleted (or moved) time log: TimeLogDeleteHandler sends the log's slots here, and a slot
 * goes only when the log is the one log that holds it — a slot another log still holds is that log's time.
 *
 * The loop returned after the FIRST slot it removed, so a log spanning several ten-minute slots kept all but one of
 * them, and it read `timeLogs[0].id` before checking that a slot has any log at all, so one orphaned slot of the
 * employee stopped the whole delete with a TypeError.
 */

const TENANT = 'tenant-a';
const ORGANIZATION = 'org-a';
const EMPLOYEE = 'employee-a';

interface IStoredSlot {
	id: string;
	timeLogs: Array<{ id: string }>;
	deletedAt?: Date;
}

function createHandler(stored: IStoredSlot[]) {
	const repository = {
		createQueryBuilder: () => {
			const params: Record<string, any> = {};
			const builder = {
				alias: 'time_slot',
				leftJoinAndSelect: () => builder,
				where: (_sql: string, values: Record<string, unknown>) => (Object.assign(params, values), builder),
				andWhere: (_sql: string, values: Record<string, unknown>) => (Object.assign(params, values), builder),
				getParameters: () => params,
				getMany: async () =>
					stored.filter(
						(slot) => !slot.deletedAt && (!params.timeSlotsIds || params.timeSlotsIds.includes(slot.id))
					)
			};
			return builder;
		},
		softRemove: jest.fn(async (removed: IStoredSlot | IStoredSlot[]) => {
			[removed].flat().forEach((slot) => (slot.deletedAt = new Date()));
			return removed;
		}),
		remove: jest.fn(async (removed: IStoredSlot | IStoredSlot[]) => removed)
	};
	const handler = new TimeSlotBulkDeleteHandler(repository as any, {} as any);
	Object.defineProperty(handler, 'ormType', { value: MultiORMEnum.TypeORM });
	return { handler, repository };
}

const deleteFor = (timeLogId: string, timeSlotsIds: string[] = [], forceDelete = false) =>
	new TimeSlotBulkDeleteCommand(
		{ organizationId: ORGANIZATION, employeeId: EMPLOYEE, timeLog: { id: timeLogId }, timeSlotsIds },
		forceDelete
	);

describe('TimeSlotBulkDeleteHandler — the slots of one time log', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});
	afterEach(() => jest.restoreAllMocks());

	it('removes every slot only the log holds and keeps the slots another log still holds', async () => {
		const stored: IStoredSlot[] = [
			{ id: 'only-0900', timeLogs: [{ id: 'log-1' }] },
			{ id: 'only-0910', timeLogs: [{ id: 'log-1' }] },
			{ id: 'shared-0920', timeLogs: [{ id: 'log-1' }, { id: 'log-2' }] },
			{ id: 'other-0930', timeLogs: [{ id: 'log-2' }] }
		];
		const { handler } = createHandler(stored);

		await handler.execute(deleteFor('log-1'));

		expect(stored.filter((slot) => slot.deletedAt).map((slot) => slot.id)).toEqual(['only-0900', 'only-0910']);
		expect(stored.filter((slot) => !slot.deletedAt).map((slot) => slot.id)).toEqual(['shared-0920', 'other-0930']);
	});

	it('is not stopped by a slot of the employee that no log holds', async () => {
		const stored: IStoredSlot[] = [
			{ id: 'orphan-0850', timeLogs: [] },
			{ id: 'only-0900', timeLogs: [{ id: 'log-1' }] }
		];
		const { handler } = createHandler(stored);

		await handler.execute(deleteFor('log-1'));

		// The orphan is not this log's to remove; the log's own slot still goes.
		expect(stored.filter((slot) => slot.deletedAt).map((slot) => slot.id)).toEqual(['only-0900']);
	});

	it('CONTROL: a log holding no slot removes nothing', async () => {
		const stored: IStoredSlot[] = [{ id: 'other-0900', timeLogs: [{ id: 'log-2' }] }];
		const { handler, repository } = createHandler(stored);

		await handler.execute(deleteFor('log-1'));

		expect(repository.softRemove).not.toHaveBeenCalled();
		expect(stored.every((slot) => !slot.deletedAt)).toBe(true);
	});
});

/**
 * #10736: the same cleanup on a force delete and on MikroORM. Every slot only the deleted log holds goes in ONE
 * call, hard or soft like the log; the loop used to remove the first of them and return.
 */
describe('TimeSlotBulkDeleteHandler — hard deletes and MikroORM', () => {
	const ONLY_LOG_1 = ['only-0900', 'only-0910', 'only-0930'];

	const storedSlots = (): IStoredSlot[] => [
		{ id: 'only-0900', timeLogs: [{ id: 'log-1' }] },
		{ id: 'only-0910', timeLogs: [{ id: 'log-1' }] },
		{ id: 'shared-0920', timeLogs: [{ id: 'log-1' }, { id: 'log-2' }] },
		{ id: 'only-0930', timeLogs: [{ id: 'log-1' }] },
		{ id: 'other-0940', timeLogs: [{ id: 'log-2' }] },
		{ id: 'orphan-0950', timeLogs: [] }
	];

	const ids = (slots: unknown) => (slots as IStoredSlot[]).map((slot) => slot.id);

	function createMikroOrmHandler(stored: IStoredSlot[]) {
		const em = {
			find: jest.fn(async () => stored.filter((slot) => !slot.deletedAt)),
			removeAndFlush: jest.fn(async (_removed: unknown) => undefined),
			persistAndFlush: jest.fn(async (_persisted: unknown) => undefined)
		};
		const handler = new TimeSlotBulkDeleteHandler({} as any, { getEntityManager: () => em } as any);
		Object.defineProperty(handler, 'ormType', { value: MultiORMEnum.MikroORM });
		return { handler, em };
	}

	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});
	afterEach(() => jest.restoreAllMocks());

	it('TypeORM: a force delete hard-removes every slot only the log holds, in one call', async () => {
		const { handler, repository } = createHandler(storedSlots());

		await handler.execute(deleteFor('log-1', [], true));

		expect(repository.remove).toHaveBeenCalledTimes(1);
		expect(ids(repository.remove.mock.calls[0][0])).toEqual(ONLY_LOG_1);
		expect(repository.softRemove).not.toHaveBeenCalled();
	});

	it('MikroORM: stamps deletedAt on every slot only the log holds, and on no other, in one flush', async () => {
		const stored = storedSlots();
		const { handler, em } = createMikroOrmHandler(stored);

		await handler.execute(deleteFor('log-1'));

		expect(em.persistAndFlush).toHaveBeenCalledTimes(1);
		expect(ids(em.persistAndFlush.mock.calls[0][0])).toEqual(ONLY_LOG_1);
		expect(em.removeAndFlush).not.toHaveBeenCalled();
		expect(stored.filter((slot) => slot.deletedAt).map((slot) => slot.id)).toEqual(ONLY_LOG_1);
	});

	it('MikroORM: a force delete removes every slot only the log holds, in one call', async () => {
		const { handler, em } = createMikroOrmHandler(storedSlots());

		await handler.execute(deleteFor('log-1', [], true));

		expect(em.removeAndFlush).toHaveBeenCalledTimes(1);
		expect(ids(em.removeAndFlush.mock.calls[0][0])).toEqual(ONLY_LOG_1);
		expect(em.persistAndFlush).not.toHaveBeenCalled();
	});
});
