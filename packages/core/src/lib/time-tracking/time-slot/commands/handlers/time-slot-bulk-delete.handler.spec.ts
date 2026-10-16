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

const deleteFor = (timeLogId: string, timeSlotsIds: string[] = []) =>
	new TimeSlotBulkDeleteCommand(
		{ organizationId: ORGANIZATION, employeeId: EMPLOYEE, timeLog: { id: timeLogId }, timeSlotsIds },
		false
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
