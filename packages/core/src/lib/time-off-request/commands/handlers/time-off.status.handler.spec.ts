// Must stay first: loads the entity graph before the handler pulls an entity.
import '../../../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { isMySQL, isPostgres } from '@gauzy/config';
import { StatusTypesEnum, StatusTypesMapRequestApprovalEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { RequestApproval } from '../../../core/entities/internal';
import { TimeOffRequest } from '../../time-off-request.entity';
import { TimeOffStatusCommand } from '../time-off.status.command';
import { TimeOffStatusHandler } from './time-off.status.handler';

/**
 * `PUT /time-off-request/approval|denied/:id` (and the GraphQL approve / deny) read the leave and its request approval,
 * set their status in memory, and `save()`d each copy on its own (follow-up listed on ever-co/ever-gauzy#11382). A save
 * writes every column its copy differs in from the stored row, so an edit of the leave that landed between the read
 * and the save was written back to what the read found; and the two saves were separate, unlocked statements, so two
 * decisions — or a decision and an answer through the request approval's own route, which locks the approval's
 * row — could leave the two rows disagreeing.
 *
 * The decision is now one transaction: the approval's row is locked first (the request approval route's lock and lock
 * order), then each row's status is written, and nothing else. Who may decide, and re-deciding a decided leave, are
 * unchanged.
 */

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: jest.fn(() => false),
	isMySQL: jest.fn(() => false)
}));

const TENANT = 'tenant-a';
const ID = 'time-off-1';

type Row = Record<string, any>;

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** The stored leave and its approval, and the handler over them. */
function setUp({ leave = true, approval = true }: { leave?: boolean; approval?: boolean } = {}) {
	const store: { leave: Row | null; approval: Row | null } = {
		leave: leave
			? { id: ID, tenantId: TENANT, start: '2026-11-02', end: '2026-11-03', status: StatusTypesEnum.REQUESTED }
			: null,
		approval: approval
			? {
					id: 'approval-1',
					requestId: ID,
					tenantId: TENANT,
					status: StatusTypesMapRequestApprovalEnum.REQUESTED
				}
			: null
	};

	const query = {
		where: jest.fn().mockReturnThis(),
		setLock: jest.fn().mockReturnThis(),
		getOne: jest.fn(async () => (store.approval ? copy(store.approval) : null))
	};
	const manager = {
		createQueryBuilder: jest.fn(() => query),
		// An UPDATE writes the columns it states, and nothing else.
		update: jest.fn(async (entity: unknown, criteria: Row, columns: Row) => {
			const row = entity === TimeOffRequest ? store.leave : store.approval;
			if (!row || row.id !== criteria.id || row.tenantId !== criteria.tenantId) {
				return { affected: 0 };
			}
			Object.assign(row, columns);
			return { affected: 1 };
		})
	};
	const timeOffRequests = {
		findOneBy: jest.fn(async ({ id, tenantId }: Row) =>
			store.leave && store.leave.id === id && store.leave.tenantId === tenantId ? copy(store.leave) : null
		),
		save: jest.fn(),
		manager: { transaction: jest.fn(async (work: any) => await work(manager)) }
	};
	const requestApprovals = { findOneBy: jest.fn(), save: jest.fn() };
	const handler = new TimeOffStatusHandler(timeOffRequests as any, requestApprovals as any);
	const decide = (status: StatusTypesEnum) => handler.execute(new TimeOffStatusCommand(ID, status));

	return { store, query, manager, timeOffRequests, requestApprovals, decide };
}

describe('TimeOffStatusHandler', () => {
	beforeEach(() => jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT));
	afterEach(() => {
		jest.restoreAllMocks();
		(isPostgres as jest.Mock).mockReturnValue(false);
		(isMySQL as jest.Mock).mockReturnValue(false);
	});

	it('CONTROL: saving the copy read before an edit put the edit’s dates back', () => {
		const { store } = setUp();

		// The pre-fix route: read, the edit lands, then the save of the copy writes all of its columns.
		const read = copy(store.leave);
		store.leave.start = '2026-11-09';
		store.leave = { ...store.leave, ...read, status: StatusTypesEnum.APPROVED };

		expect(store.leave).toMatchObject({ start: '2026-11-02', status: StatusTypesEnum.APPROVED });
	});

	it('writes only the status: an edit that landed after the read is kept', async () => {
		const { store, timeOffRequests, decide } = setUp();
		// The edit lands right after the handler's read.
		const read = timeOffRequests.findOneBy.getMockImplementation() as (where: Row) => Promise<Row | null>;
		timeOffRequests.findOneBy.mockImplementationOnce(async (where: Row) => {
			const row = await read(where);
			store.leave.start = '2026-11-09';
			return row;
		});

		await decide(StatusTypesEnum.APPROVED);

		expect(store.leave).toMatchObject({ start: '2026-11-09', status: StatusTypesEnum.APPROVED });
		expect(store.approval.status).toBe(StatusTypesMapRequestApprovalEnum.APPROVED);
		expect(timeOffRequests.save).not.toHaveBeenCalled();
	});

	it.each([
		['PostgreSQL', isPostgres],
		['MySQL', isMySQL]
	])('on %s locks the approval FOR UPDATE, then writes both statuses on the transaction', async (_, dialect) => {
		(dialect as jest.Mock).mockReturnValue(true);
		const { query, manager, timeOffRequests, requestApprovals, decide } = setUp();

		await decide(StatusTypesEnum.DENIED);

		expect(timeOffRequests.manager.transaction).toHaveBeenCalledTimes(1);
		expect(manager.createQueryBuilder).toHaveBeenCalledWith(RequestApproval, 'request_approval');
		expect(query.where).toHaveBeenCalledWith({ requestId: ID, tenantId: TENANT });
		expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
		expect(query.getOne.mock.invocationCallOrder[0]).toBeLessThan(manager.update.mock.invocationCallOrder[0]);
		const denied = { status: StatusTypesMapRequestApprovalEnum.DENIED };
		expect(manager.update.mock.calls).toEqual([
			[TimeOffRequest, { id: ID, tenantId: TENANT }, { status: StatusTypesEnum.DENIED }],
			[RequestApproval, { id: 'approval-1', tenantId: TENANT }, denied]
		]);
		// Nothing is written through the repositories, outside the transaction.
		expect(timeOffRequests.save).not.toHaveBeenCalled();
		expect(requestApprovals.save).not.toHaveBeenCalled();
	});

	it('on SQLite takes no row lock, and still reads the approval: the transaction is serialized there', async () => {
		const { query, decide } = setUp();

		await decide(StatusTypesEnum.APPROVED);

		expect(query.setLock).not.toHaveBeenCalled();
		expect(query.getOne).toHaveBeenCalledTimes(1);
	});

	it('writes only the leave when it has no request approval, as before', async () => {
		const { store, manager, decide } = setUp({ approval: false });

		await decide(StatusTypesEnum.APPROVED);

		expect(manager.update.mock.calls.map(([entity]) => entity)).toEqual([TimeOffRequest]);
		expect(store.leave.status).toBe(StatusTypesEnum.APPROVED);
	});

	it('still decides a decided leave again: who may decide, and when, is unchanged', async () => {
		const { store, decide } = setUp();
		store.leave.status = StatusTypesEnum.APPROVED;

		await decide(StatusTypesEnum.DENIED);

		expect(store.leave.status).toBe(StatusTypesEnum.DENIED);
		expect(store.approval.status).toBe(StatusTypesMapRequestApprovalEnum.DENIED);
	});

	it('answers the leave as decided, read again after the commit', async () => {
		const { decide } = setUp();

		await expect(decide(StatusTypesEnum.APPROVED)).resolves.toMatchObject({
			id: ID,
			status: StatusTypesEnum.APPROVED
		});
	});

	it('refuses an unknown leave (404) before any transaction', async () => {
		const { timeOffRequests, decide } = setUp({ leave: false });

		await expect(decide(StatusTypesEnum.APPROVED)).rejects.toBeInstanceOf(NotFoundException);

		expect(timeOffRequests.manager.transaction).not.toHaveBeenCalled();
	});

	it('refuses (404) without a tenant to scope the lookup by', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null);
		const { timeOffRequests, decide } = setUp();

		await expect(decide(StatusTypesEnum.APPROVED)).rejects.toBeInstanceOf(NotFoundException);

		expect(timeOffRequests.findOneBy).not.toHaveBeenCalled();
	});
});
