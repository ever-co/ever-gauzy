// Must stay first: loads the entity graph before the service pulls an entity (see activity.controller.spec.ts).
import '../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LockMode } from '@mikro-orm/core';
import { FindOperator } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import {
	ApprovalPolicyTypesStringEnum,
	PermissionsEnum,
	RequestApprovalStatusTypesEnum,
	RolesEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { RequestApprovalEmployee, RequestApprovalTeam } from '../core/entities/internal';
import { MultiORMEnum } from '../core/utils';
import { RequestApproval } from './request-approval.entity';
import {
	IRequestApprovalAnswerTransaction,
	IRequestApprovalEditTransaction,
	RequestApprovalService
} from './request-approval.service';

/**
 * Editing a request approval while it is being answered (follow-up of ever-co/ever-gauzy#11382).
 *
 * An answer is one transaction under the request's row lock (#11382). The edit (`PUT /request-approval/:id`, GraphQL
 * `updateRequestApproval`) was not: it removed the approver slots, filed them again as `REQUESTED` and saved the
 * request, each statement on its own and under no lock. An answer that had read the slots before the edit and wrote
 * after it recorded its decision on a slot that no longer existed and decided the request: a decided request whose
 * slots are all open.
 *
 * The edit is now one transaction that takes the same row lock first. The store below has what the service relies on
 * from PostgreSQL and MySQL: the lock holds the request's row until the transaction ends, a statement reads what is
 * committed, and the writes become visible at the commit — never, when the body throws. Its `rowLocks: false` mode is
 * the old behaviour (every statement committed on its own, no lock), kept as the control that shows the race is real.
 * The interleaving is forced: the first of the two pauses (an answer after its reads, an edit after its lock).
 *
 * Who may edit and what an edit changes are untouched: an edit still re-opens the request it edits, decided or not.
 * The last block pins the statements each ORM arm sends.
 */

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: jest.fn(() => false),
	isMySQL: jest.fn(() => false)
}));

const { REQUESTED, APPROVED } = RequestApprovalStatusTypesEnum;

const TENANT = 'tenant-a';
const ORGANIZATION = 'organization-a';
const OTHER_ORGANIZATION = 'organization-b';
const ID = 'approval-1';

interface IFixtureUser {
	id: string;
	employeeId: string | null;
	role: RolesEnum;
	permissions: PermissionsEnum[];
}

/** A designated approver of the request. */
const ALICE: IFixtureUser = {
	id: 'user-alice',
	employeeId: 'employee-alice',
	role: RolesEnum.MANAGER,
	permissions: [PermissionsEnum.REQUEST_APPROVAL_EDIT]
};
/** A manager of the organization who edits the request. */
const EDITOR: IFixtureUser = {
	id: 'user-editor',
	employeeId: null,
	role: RolesEnum.MANAGER,
	permissions: [PermissionsEnum.REQUEST_APPROVAL_EDIT]
};

/** Who is calling, per asynchronous flow, so an answer and an edit in flight each read their own caller. */
const caller = new AsyncLocalStorage<IFixtureUser>();

function contextUser(user: IFixtureUser | undefined) {
	return user
		? ({
				id: user.id,
				tenantId: TENANT,
				employeeId: user.employeeId,
				lastOrganizationId: ORGANIZATION,
				role: { name: user.role },
				permissions: user.permissions
			} as any)
		: null;
}

type Row = Record<string, any>;

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Lets every pending promise callback run, so a paused or blocked transaction has gone as far as it can. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

function deferred() {
	let resolve: () => void = () => undefined;
	const promise = new Promise<void>((done) => (resolve = done));
	return { promise, resolve };
}

/** The edit every test makes: a new name, and the same approver. */
const EDIT = {
	name: 'Laptop (revised)',
	min_count: 1,
	organizationId: ORGANIZATION,
	employeeApprovals: [ALICE.employeeId]
} as any;

/** The tenant's employees, as the approver lookup reads them. */
const EMPLOYEES = [{ id: ALICE.employeeId, tenantId: TENANT }];

/** Whether a row's id matches a `where` member: a value, or `In([...])`. */
const idMatches = (id: unknown, criterion: unknown) =>
	criterion instanceof FindOperator ? (criterion.value as unknown[]).includes(id) : id === criterion;

const employeeRepository = () => ({
	find: jest.fn(async ({ where }: any) =>
		EMPLOYEES.filter((row) => row.tenantId === where.tenantId && idMatches(row.id, where.id))
	)
});

/** The checks the CRUD base's `save()` makes before it writes (its own specs pin them). */
const SAVE_CHECKS = ['assertNotForeignRow', 'assertNestedGraphNotForeign', 'assertInsideOrganizationBoundary'];

/**
 * The store: one request and its employee slots, and the answer's and the edit's transactions over them, which take
 * one row lock.
 */
class Store {
	request: Row = {
		id: ID,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Laptop',
		status: REQUESTED,
		min_count: 1,
		createdByUserId: 'user-requester',
		requestType: ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING
	};
	employeeSlots: Row[] = [{ id: 'slot-alice', employeeId: ALICE.employeeId, status: REQUESTED }];
	/** The writes of every commit, in commit order, each led by its caller. */
	commits: string[][] = [];
	/** Transactions to pause, by caller: an answer after its reads, an edit after its lock. */
	pauses = new Map<string, Promise<void>>();

	private lock: Promise<void> = Promise.resolve();
	private filed = 0;

	constructor(private readonly rowLocks = true) {}

	/** Runs `work` as one transaction: its writes land at the commit, or, without row locks, each at once. */
	private async run<T, R>(
		build: (write: (apply: () => string) => void, lock: () => Promise<void>) => T,
		work: (transaction: T) => Promise<R>
	): Promise<R> {
		const who = caller.getStore()?.id;
		const pending: Array<() => string> = [];
		const applied: string[] = [];
		let release = () => undefined as void;

		const write = (apply: () => string): void => {
			if (this.rowLocks) {
				pending.push(apply);
			} else {
				applied.push(apply());
			}
		};
		const lock = async () => {
			if (!this.rowLocks) {
				return;
			}
			// FOR UPDATE: wait for the transaction holding the row, then hold it until this one ends.
			const held = this.lock;
			const next = deferred();
			this.lock = next.promise;
			release = next.resolve;
			await held;
		};

		try {
			const result = await work(build(write, lock));
			this.commits.push([who, ...applied, ...pending.map((apply) => apply())]);
			return result;
		} finally {
			release();
		}
	}

	private lockedRow(id: string, tenantId: string) {
		return this.request.id === id && this.request.tenantId === tenantId ? (copy(this.request) as any) : null;
	}

	answerTransaction<R>(work: (transaction: IRequestApprovalAnswerTransaction) => Promise<R>): Promise<R> {
		const who = caller.getStore()?.id;
		return this.run<IRequestApprovalAnswerTransaction, R>(
			(write, lock) => ({
				lockRequest: async (id, tenantId) => {
					await lock();
					return this.lockedRow(id, tenantId);
				},
				readSlots: async () => {
					const slots = { employeeApprovals: copy(this.employeeSlots) as any[], teamApprovals: [] };
					await this.pauses.get(who);
					return slots;
				},
				readApproverTeams: async () => [],
				writeSlots: async (_kind, ids, _tenantId, status) =>
					write(() => {
						this.employeeSlots
							.filter((slot) => ids.includes(slot.id))
							.forEach((slot) => (slot.status = status));
						return `slot:${ids.join(',')}:${status}`;
					}),
				writeRequestStatus: async (_id, _tenantId, status) =>
					write(() => {
						this.request.status = status;
						return `request:${status}`;
					}),
				readLinkedDocument: async () => null,
				moveTimeOff: async () => 0,
				moveEquipmentSharing: async () => undefined
			}),
			work
		);
	}

	editTransaction<R>(work: (transaction: IRequestApprovalEditTransaction) => Promise<R>): Promise<R> {
		const who = caller.getStore()?.id;
		return this.run<IRequestApprovalEditTransaction, R>(
			(write, lock) => ({
				lockRequest: async (id, tenantId) => {
					await lock();
					const row = this.lockedRow(id, tenantId);
					await this.pauses.get(who);
					return row;
				},
				deleteSlots: async () =>
					write(() => {
						this.employeeSlots = [];
						return 'slots:removed';
					}),
				saveRequest: async (requestApproval) => {
					write(() => {
						const saved = copy(requestApproval) as Row;
						const { employeeApprovals = [], teamApprovals: _teams, ...columns } = saved;
						this.request = { ...this.request, ...columns };
						this.employeeSlots = employeeApprovals.map((slot: Row) => ({
							id: `slot-filed-${++this.filed}`,
							employeeId: slot.employeeId,
							status: slot.status
						}));
						return `request:saved:${columns.status}`;
					});
					return requestApproval;
				},
				writeRequestStatus: async (_id, _tenantId, status) =>
					write(() => {
						this.request.status = status;
						return `request:${status}`;
					})
			}),
			work
		);
	}
}

function system(store: Store) {
	const service = new RequestApprovalService(
		{} as any,
		{} as any,
		employeeRepository() as any,
		...(Array.from({ length: 5 }, () => ({})) as [any, any, any, any, any])
	);
	// The caller's scoped read, outside the transaction: what is committed when it runs.
	jest.spyOn(service, 'findOneByIdString').mockImplementation(async () => copy(store.request) as any);
	jest.spyOn(service as any, 'answerTransaction').mockImplementation((work: any) => store.answerTransaction(work));
	jest.spyOn(service as any, 'editTransaction').mockImplementation((work: any) => store.editTransaction(work));
	// The checks `save()` makes before it writes.
	for (const check of SAVE_CHECKS) {
		jest.spyOn(service as any, check).mockResolvedValue(undefined);
	}

	/** Settles a call into a result, so a refusal can be inspected. */
	const settled = (user: IFixtureUser, call: () => Promise<unknown>) =>
		caller.run(user, () =>
			call().then(
				(value) => ({ value, error: undefined as unknown }),
				(error) => ({ value: undefined, error })
			)
		);
	const answer = (user: IFixtureUser, status: number) =>
		settled(user, () => service.updateStatusRequestApprovalByEmployeeOrTeam(ID, status));
	const edit = (user: IFixtureUser = EDITOR) => settled(user, () => service.updateRequestApproval(ID, EDIT));

	return { service, answer, edit };
}

/** Runs `first` until it pauses, then starts `second` (which runs in full, or until it blocks on the lock). */
async function interleave(
	store: Store,
	first: { user: IFixtureUser; start: () => Promise<any> },
	second: () => Promise<any>
) {
	const pause = deferred();
	store.pauses.set(first.user.id, pause.promise);

	const firstCall = first.start();
	await settle();
	const secondCall = second();
	await settle();
	const commitsWhilePaused = store.commits.map(([who]) => who);

	pause.resolve();
	const [firstResult, secondResult] = await Promise.all([firstCall, secondCall]);
	return { firstResult, secondResult, commitsWhilePaused };
}

describe('editing a request approval is one transaction under the answer’s row lock', () => {
	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(RequestContext, 'currentUser').mockImplementation(() => contextUser(caller.getStore()));
	});
	afterEach(() => jest.restoreAllMocks());

	it('CONTROL: without the lock, an answer read before the edit decides the request the edit re-opened', async () => {
		const store = new Store(false);
		const { answer, edit } = system(store);

		const { firstResult, secondResult } = await interleave(
			store,
			{ user: ALICE, start: () => answer(ALICE, APPROVED) },
			() => edit()
		);

		expect(firstResult.error).toBeUndefined();
		expect(secondResult.error).toBeUndefined();
		// The answer's slot write named the slot the edit removed, and its status landed after the edit's save:
		// a decided request whose only slot is open.
		expect(store.request.status).toBe(APPROVED);
		expect(store.employeeSlots).toEqual([{ id: 'slot-filed-1', employeeId: ALICE.employeeId, status: REQUESTED }]);
	});

	it('an edit behind an answer waits for it, then re-opens the decided request with fresh slots', async () => {
		const store = new Store();
		const { answer, edit } = system(store);

		const { firstResult, secondResult, commitsWhilePaused } = await interleave(
			store,
			{ user: ALICE, start: () => answer(ALICE, APPROVED) },
			() => edit()
		);

		expect(firstResult.error).toBeUndefined();
		expect(secondResult.error).toBeUndefined();
		// The edit waited on the lock the answer held.
		expect(commitsWhilePaused).toEqual([]);
		expect(store.commits).toEqual([
			[ALICE.id, `slot:slot-alice:${APPROVED}`, `request:${APPROVED}`],
			[EDITOR.id, 'slots:removed', `request:saved:${REQUESTED}`, `request:${REQUESTED}`]
		]);
		// Re-opened as a whole, as an edit of a decided request was before: the request and every slot open.
		expect(store.request).toMatchObject({ status: REQUESTED, name: 'Laptop (revised)' });
		expect(store.employeeSlots).toEqual([{ id: 'slot-filed-1', employeeId: ALICE.employeeId, status: REQUESTED }]);
	});

	it('an answer behind an edit waits for it, then answers the re-opened request on the slots the edit filed', async () => {
		const store = new Store();
		const { answer, edit } = system(store);

		const { firstResult, secondResult, commitsWhilePaused } = await interleave(
			store,
			{ user: EDITOR, start: () => edit() },
			() => answer(ALICE, APPROVED)
		);

		expect(firstResult.error).toBeUndefined();
		expect(secondResult.error).toBeUndefined();
		expect(commitsWhilePaused).toEqual([]);
		expect(store.commits.map(([who]) => who)).toEqual([EDITOR.id, ALICE.id]);
		// Alice's answer is recorded on her new slot, and decides the request the edit saved.
		expect(store.employeeSlots).toEqual([{ id: 'slot-filed-1', employeeId: ALICE.employeeId, status: APPROVED }]);
		expect(store.request).toMatchObject({ status: APPROVED, name: 'Laptop (revised)' });
	});

	it('re-opens the request in a statement of its own, whatever the save’s copy held', async () => {
		const store = new Store();
		const { edit } = system(store);

		await edit();

		// The slots removed, the request saved, and its status written again on its own.
		const edited = [EDITOR.id, 'slots:removed', `request:saved:${REQUESTED}`, `request:${REQUESTED}`];
		expect(store.commits).toEqual([edited]);
	});

	it('refuses (404) and writes nothing when the request moved out of the editor’s organization under the lock', async () => {
		const store = new Store();
		const { edit, service } = system(store);
		// The scoped read finds the request in the editor's organization; it is moved before the lock is granted.
		jest.spyOn(service, 'findOneByIdString').mockImplementationOnce(async () => {
			const read = copy(store.request);
			store.request.organizationId = OTHER_ORGANIZATION;
			return read as any;
		});

		const { error } = await edit();

		expect(error).toBeInstanceOf(NotFoundException);
		expect(store.commits).toEqual([]);
		expect(store.employeeSlots).toEqual([{ id: 'slot-alice', employeeId: ALICE.employeeId, status: REQUESTED }]);
	});

	it('makes the checks `save()` makes before the transaction opens', async () => {
		const store = new Store();
		const { edit, service } = system(store);

		await edit();

		const transaction = (service as any).editTransaction as jest.Mock;
		for (const check of SAVE_CHECKS) {
			const spy = (service as any)[check] as jest.Mock;
			expect(spy).toHaveBeenCalledTimes(1);
			expect(spy.mock.invocationCallOrder[0]).toBeLessThan(transaction.mock.invocationCallOrder[0]);
		}
	});
});

describe('the edit transaction on each ORM', () => {
	beforeEach(() => jest.spyOn(RequestContext, 'currentUser').mockReturnValue(contextUser(EDITOR)));
	afterEach(() => {
		jest.restoreAllMocks();
		(isPostgres as jest.Mock).mockReturnValue(false);
		(isMySQL as jest.Mock).mockReturnValue(false);
	});

	const stored = () => ({ id: ID, tenantId: TENANT, organizationId: ORGANIZATION, name: 'Laptop', status: APPROVED });

	/** The re-opening write every edit ends with. */
	const reopened = [RequestApproval, { id: ID, tenantId: TENANT }, { status: REQUESTED }];

	function checksPass(service: RequestApprovalService) {
		for (const check of SAVE_CHECKS) {
			jest.spyOn(service as any, check).mockResolvedValue(undefined);
		}
	}

	describe('TypeORM', () => {
		function typeOrm(locked: Row | null = stored()) {
			const statements: string[] = [];
			const query = {
				where: jest.fn().mockReturnThis(),
				setLock: jest.fn().mockReturnThis(),
				getOne: jest.fn(async () => {
					statements.push('lock');
					return locked;
				})
			};
			const manager = {
				createQueryBuilder: jest.fn(() => query),
				delete: jest.fn(async (entity: { name: string }, ..._args: unknown[]) => {
					statements.push(`delete:${entity.name}`);
					return { affected: 1 };
				}),
				save: jest.fn(async (_entity: unknown, row: Row) => {
					statements.push('save');
					return row;
				}),
				update: jest.fn(async (entity: { name: string }, ..._args: unknown[]) => {
					statements.push(`update:${entity.name}`);
					return { affected: 1 };
				})
			};
			const repository = { manager: { transaction: jest.fn(async (work: any) => await work(manager)) } };
			const service = new RequestApprovalService(
				repository as any,
				{} as any,
				employeeRepository() as any,
				...(Array.from({ length: 5 }, () => ({})) as [any, any, any, any, any])
			);
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			jest.spyOn(service, 'findOneByIdString').mockResolvedValue(stored() as any);
			checksPass(service);
			const save = jest.spyOn(service, 'save');
			return { service, manager, query, repository, statements, save };
		}

		it.each([
			['PostgreSQL', isPostgres],
			['MySQL', isMySQL]
		])('on %s locks the request FOR UPDATE, then writes everything on the transaction', async (_, dialect) => {
			(dialect as jest.Mock).mockReturnValue(true);
			const { service, manager, query, repository, statements, save } = typeOrm();

			await service.updateRequestApproval(ID, EDIT);

			expect(repository.manager.transaction).toHaveBeenCalledTimes(1);
			expect(manager.createQueryBuilder).toHaveBeenCalledWith(RequestApproval, 'request_approval');
			expect(query.where).toHaveBeenCalledWith({ id: ID, tenantId: TENANT });
			expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
			expect(statements).toEqual([
				'lock',
				`delete:${RequestApprovalEmployee.name}`,
				`delete:${RequestApprovalTeam.name}`,
				'save',
				`update:${RequestApproval.name}`
			]);
			expect(manager.delete.mock.calls).toEqual([
				[RequestApprovalEmployee, { requestApprovalId: ID }],
				[RequestApprovalTeam, { requestApprovalId: ID }]
			]);
			const [entity, row] = manager.save.mock.calls[0];
			expect(entity).toBe(RequestApproval);
			expect(row).toMatchObject({
				id: ID,
				name: 'Laptop (revised)',
				status: REQUESTED,
				tenantId: TENANT,
				tenant: { id: TENANT }
			});
			expect(row.employeeApprovals.map((slot: Row) => [slot.employeeId, slot.status])).toEqual([
				[ALICE.employeeId, REQUESTED]
			]);
			expect(manager.update.mock.calls).toEqual([reopened]);
			// The service's own save runs on another connection, whose write would wait on this transaction's lock.
			expect(save).not.toHaveBeenCalled();
		});

		it('on SQLite takes no row lock: the transaction is serialized there', async () => {
			const { service, query } = typeOrm();

			await service.updateRequestApproval(ID, EDIT);

			expect(query.setLock).not.toHaveBeenCalled();
			expect(query.getOne).toHaveBeenCalledTimes(1);
		});

		it('refuses (404) and writes nothing when the request is gone under the lock', async () => {
			const { service, manager } = typeOrm(null);

			await expect(service.updateRequestApproval(ID, EDIT)).rejects.toBeInstanceOf(NotFoundException);

			expect(manager.delete).not.toHaveBeenCalled();
			expect(manager.save).not.toHaveBeenCalled();
			expect(manager.update).not.toHaveBeenCalled();
		});

		it('refuses (404) a confined editor when the locked row is another organization’s', async () => {
			const { service, manager } = typeOrm({ ...stored(), organizationId: OTHER_ORGANIZATION });

			await expect(service.updateRequestApproval(ID, EDIT)).rejects.toBeInstanceOf(NotFoundException);

			expect(manager.delete).not.toHaveBeenCalled();
			expect(manager.save).not.toHaveBeenCalled();
		});

		it('answers a failed save as 400, as the CRUD base does, and writes nothing after it', async () => {
			const { service, manager } = typeOrm();
			manager.save.mockRejectedValueOnce(new Error('duplicate key'));

			await expect(service.updateRequestApproval(ID, EDIT)).rejects.toBeInstanceOf(BadRequestException);

			expect(manager.update).not.toHaveBeenCalled();
		});
	});

	describe('MikroORM', () => {
		function mikroOrm() {
			const statements: string[] = [];
			const em = {
				findOne: jest.fn(async (..._args: unknown[]) => {
					statements.push('lock');
					return stored();
				}),
				nativeDelete: jest.fn(async (entity: { name: string }, ..._args: unknown[]) => {
					statements.push(`delete:${entity.name}`);
					return 1;
				}),
				nativeUpdate: jest.fn(async (entity: { name: string }, ..._args: unknown[]) => {
					statements.push(`update:${entity.name}`);
					return 1;
				}),
				getMetadata: () => ({ find: () => undefined })
			};
			const transactional = jest.fn(async (work: any) => await work(em));
			const service = new RequestApprovalService(
				{} as any,
				{ getEntityManager: () => ({ transactional }) } as any,
				{} as any,
				{ find: jest.fn(async () => EMPLOYEES) } as any,
				...(Array.from({ length: 4 }, () => ({})) as [any, any, any, any])
			);
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
			jest.spyOn(service, 'findOneByIdString').mockResolvedValue(stored() as any);
			jest.spyOn(service as any, 'serialize').mockImplementation((row: any) => ({ ...row }));
			checksPass(service);
			// The CRUD base's save, which MikroORM runs on the transaction's fork (its own specs pin the details).
			const save = jest.spyOn(service, 'save').mockImplementation(async (entity: any) => {
				statements.push('save');
				return entity;
			});
			return { service, em, transactional, statements, save };
		}

		it.each([
			['PostgreSQL', isPostgres],
			['MySQL', isMySQL]
		])('on %s locks with PESSIMISTIC_WRITE, then writes everything in the transaction', async (_, dialect) => {
			(dialect as jest.Mock).mockReturnValue(true);
			const { service, em, transactional, statements, save } = mikroOrm();

			await service.updateRequestApproval(ID, EDIT);

			expect(transactional).toHaveBeenCalledTimes(1);
			expect(em.findOne).toHaveBeenCalledWith(
				RequestApproval,
				{ id: ID, tenantId: TENANT },
				{ disableIdentityMap: true, lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			expect(statements).toEqual([
				'lock',
				`delete:${RequestApprovalEmployee.name}`,
				`delete:${RequestApprovalTeam.name}`,
				'save',
				`update:${RequestApproval.name}`
			]);
			expect(em.nativeDelete.mock.calls).toEqual([
				[RequestApprovalEmployee, { requestApproval: ID }],
				[RequestApprovalTeam, { requestApproval: ID }]
			]);
			expect(save).toHaveBeenCalledWith(
				expect.objectContaining({ id: ID, name: 'Laptop (revised)', status: REQUESTED })
			);
			expect(em.nativeUpdate.mock.calls).toEqual([reopened]);
		});

		it('on SQLite takes no lock mode: the transaction is serialized there', async () => {
			const { service, em } = mikroOrm();

			await service.updateRequestApproval(ID, EDIT);

			expect(em.findOne).toHaveBeenCalledWith(
				RequestApproval,
				{ id: ID, tenantId: TENANT },
				{ disableIdentityMap: true }
			);
		});
	});
});
