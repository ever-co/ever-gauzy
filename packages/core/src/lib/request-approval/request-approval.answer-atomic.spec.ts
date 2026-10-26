// Must stay first: loads the entity graph before the service pulls an entity (see activity.controller.spec.ts).
import '../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LockMode } from '@mikro-orm/core';
import { In } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import {
	ApprovalPolicyTypesStringEnum,
	PermissionsEnum,
	RequestApprovalStatusTypesEnum,
	RolesEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import {
	EquipmentSharing,
	RequestApprovalEmployee,
	RequestApprovalTeam,
	TimeOffRequest
} from '../core/entities/internal';
import { MultiORMEnum } from '../core/utils';
import { RequestApprovalStatusCommand } from './commands/request-approval.status.command';
import { RequestApprovalStatusHandler } from './commands/handlers/request-approval.status.handler';
import { RequestApproval } from './request-approval.entity';
import { IRequestApprovalAnswerTransaction, RequestApprovalService } from './request-approval.service';

/**
 * Two approvers answering one request approval at the same time (follow-up of ever-co/ever-gauzy#11372).
 *
 * The answer used to be a read, a decision in memory, and then the writes, each on its own statement: two approvers
 * who both read the request open both decided it, and the second write won. An approval read before a refusal was
 * saved overwrote the refusal, the equipment sharing followed whichever document write came last, and two approvals
 * of a request that needs two each counted one and left the request open for good.
 *
 * The answer is now one transaction that reads the request again under a row lock (`SELECT … FOR UPDATE`), decides on
 * what the lock found, and writes the slots, the request and the document before it commits. The store below has what
 * the service relies on from PostgreSQL and MySQL: a statement reads what is committed, the lock holds the request's
 * row until the transaction ends, and writes become visible when the body returns — never, when it throws. Its
 * `rowLocks: false` mode is the old behaviour, kept as the control that shows each race is real. The interleaving is
 * forced: an answer can be paused after its reads, while the other one runs.
 *
 * The last block pins the statements each ORM arm sends: the lock mode, the transaction's own manager for every read
 * and write, and no lock on SQLite, whose transactions are serialized instead.
 */

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: jest.fn(() => false),
	isMySQL: jest.fn(() => false)
}));

const { REQUESTED, APPROVED, REFUSED } = RequestApprovalStatusTypesEnum;

const TENANT = 'tenant-a';
const ORGANIZATION = 'organization-a';

interface IFixtureUser {
	id: string;
	employeeId: string | null;
	role: RolesEnum;
	permissions: PermissionsEnum[];
}

/** Two managers the tenant lets decide equipment sharings, each a designated approver of the request. */
const ALICE: IFixtureUser = {
	id: 'user-alice',
	employeeId: 'employee-alice',
	role: RolesEnum.MANAGER,
	permissions: [PermissionsEnum.REQUEST_APPROVAL_EDIT, PermissionsEnum.EQUIPMENT_APPROVE_REQUEST]
};
const BOB: IFixtureUser = {
	id: 'user-bob',
	employeeId: 'employee-bob',
	role: RolesEnum.MANAGER,
	permissions: [PermissionsEnum.REQUEST_APPROVAL_EDIT, PermissionsEnum.EQUIPMENT_APPROVE_REQUEST]
};
/** Alice without the equipment decision grant: an approver whose settling answer is refused. */
const ALICE_WITHOUT_GRANT: IFixtureUser = { ...ALICE, permissions: [PermissionsEnum.REQUEST_APPROVAL_EDIT] };
const ADMIN: IFixtureUser = {
	id: 'user-admin',
	employeeId: null,
	role: RolesEnum.ADMIN,
	permissions: [
		PermissionsEnum.REQUEST_APPROVAL_EDIT,
		PermissionsEnum.EQUIPMENT_APPROVE_REQUEST,
		PermissionsEnum.TIME_OFF_EDIT
	]
};

/** Who is calling, per asynchronous flow, so two answers in flight each read their own caller. */
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

/** Lets every pending promise callback run, so a paused or blocked answer has gone as far as it can. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

function deferred() {
	let resolve: () => void = () => undefined;
	const promise = new Promise<void>((done) => (resolve = done));
	return { promise, resolve };
}

/**
 * The store: one request with its employee slots, the documents it may be about, and the answer's transaction over
 * them.
 */
class Store {
	request: Row;
	employeeSlots: Row[];
	documents: Record<string, Row> = {
		'equipment-sharing': { id: 'sharing-1', organizationId: ORGANIZATION, status: REQUESTED },
		'time-off': { id: 'time-off-1', organizationId: ORGANIZATION, status: 'REQUESTED' }
	};
	/** The writes of every commit, in commit order, each led by its caller. */
	commits: string[][] = [];
	/** The callers that got past the request's lock, in order. */
	locked: string[] = [];
	/** Answers to pause after their reads, by caller. */
	pauses = new Map<string, Promise<void>>();

	private lock: Promise<void> = Promise.resolve();

	constructor(
		request: Row,
		private readonly rowLocks = true,
		/**
		 * MySQL's REPEATABLE READ: a transaction's plain reads answer from the snapshot taken at its first plain read
		 * (the slots, after the lock), while a locking read — and an UPDATE's compare-and-set — reads what is
		 * committed. Off, every statement reads what is committed, as on PostgreSQL's READ COMMITTED.
		 */
		private readonly repeatableRead = false
	) {
		const { employeeApprovals = [], ...rest } = request;
		this.request = rest;
		this.employeeSlots = employeeApprovals;
	}

	async transaction<R>(work: (transaction: IRequestApprovalAnswerTransaction) => Promise<R>): Promise<R> {
		const who = caller.getStore()?.id;
		const pending: Array<() => string> = [];
		let release = () => undefined as void;
		let snapshot: Record<string, Row> | undefined;

		const transaction: IRequestApprovalAnswerTransaction = {
			lockRequest: async (id, tenantId) => {
				if (this.rowLocks) {
					// FOR UPDATE: wait for the transaction holding the row, then hold it until this one ends.
					const held = this.lock;
					const next = deferred();
					this.lock = next.promise;
					release = next.resolve;
					await held;
				}
				this.locked.push(who);
				return this.request.id === id && this.request.tenantId === tenantId
					? (copy(this.request) as any)
					: null;
			},
			readSlots: async () => {
				if (this.repeatableRead) {
					snapshot ??= copy(this.documents);
				}
				const slots = { employeeApprovals: copy(this.employeeSlots) as any[], teamApprovals: [] };
				await this.pauses.get(who);
				return slots;
			},
			readApproverTeams: async () => [],
			// The document's filer and subjects: nobody here, so only the request's own requester is refused.
			readLinkedDocumentRequesters: async () => ({ userIds: [], employeeIds: [] }),
			writeSlots: async (_kind, ids, _tenantId, status) => {
				pending.push(() => {
					this.employeeSlots
						.filter((slot) => ids.includes(slot.id))
						.forEach((slot) => (slot.status = status));
					return `slot:${ids.join(',')}:${status}`;
				});
			},
			writeRequestStatus: async (_id, _tenantId, status) => {
				pending.push(() => {
					this.request.status = status;
					return `request:${status}`;
				});
			},
			readLinkedDocument: async (kind, id, _tenantId, locked) => {
				const documents = !locked && snapshot ? snapshot : this.documents;
				return documents[kind]?.id === id ? (copy(documents[kind]) as any) : null;
			},
			moveTimeOff: async (_id, _tenantId, status) => {
				// The compare-and-set: the leave moves only while it is REQUESTED.
				if (this.documents['time-off'].status !== 'REQUESTED') {
					return 0;
				}
				pending.push(() => {
					this.documents['time-off'].status = status;
					return `time-off:${status}`;
				});
				return 1;
			},
			moveEquipmentSharing: async (_id, _tenantId, status) => {
				pending.push(() => {
					this.documents['equipment-sharing'].status = status;
					return `equipment:${status}`;
				});
			}
		};

		try {
			const result = await work(transaction);
			// The commit: every write at once.
			this.commits.push([who, ...pending.map((write) => write())]);
			return result;
		} finally {
			release();
		}
	}
}

function requestRow(overrides: Row = {}): Row {
	return {
		id: 'approval-1',
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Laptop',
		status: REQUESTED,
		min_count: 1,
		createdByUserId: 'user-requester',
		requestType: ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING,
		requestId: 'sharing-1',
		employeeApprovals: [
			{ id: 'slot-alice', employeeId: ALICE.employeeId, status: REQUESTED },
			{ id: 'slot-bob', employeeId: BOB.employeeId, status: REQUESTED }
		],
		...overrides
	};
}

function system(store: Store) {
	const service = new RequestApprovalService(
		...(Array.from({ length: 8 }, () => ({})) as [any, any, any, any, any, any, any, any])
	);
	// The caller's scoped read, outside the transaction: what is committed when it runs.
	jest.spyOn(service, 'findOneByIdString').mockImplementation(async () => copy(store.request) as any);
	jest.spyOn(service as any, 'answerTransaction').mockImplementation((work: any) => store.transaction(work));
	const handler = new RequestApprovalStatusHandler(service);

	/** Starts an answer as `user`, settled into a result so a refusal can be inspected. */
	const answer = (user: IFixtureUser, status: number) =>
		caller.run(user, () =>
			handler.execute(new RequestApprovalStatusCommand('approval-1', status)).then(
				(value) => ({ value, error: undefined as unknown }),
				(error) => ({ value: undefined, error })
			)
		);

	return { answer, service };
}

/**
 * Runs `first` until it has read the request, then `second` in full (or until it blocks on the lock), then lets
 * `first` finish.
 */
async function interleave(
	store: Store,
	first: { user: IFixtureUser; start: () => Promise<any> },
	second: { start: () => Promise<any> }
) {
	const pause = deferred();
	store.pauses.set(first.user.id, pause.promise);

	const firstAnswer = first.start();
	await settle();
	const secondAnswer = second.start();
	await settle();
	const lockedWhilePaused = [...store.locked];

	pause.resolve();
	const [firstResult, secondResult] = await Promise.all([firstAnswer, secondAnswer]);
	return { firstResult, secondResult, lockedWhilePaused };
}

describe('answering a request approval is one transaction under a row lock', () => {
	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(RequestContext, 'currentUser').mockImplementation(() => contextUser(caller.getStore()));
	});
	afterEach(() => jest.restoreAllMocks());

	describe('an approval and a refusal at the same time', () => {
		it('CONTROL: without the row lock, an approval read before a refusal was saved overwrites it', async () => {
			const store = new Store(requestRow(), false);
			const { answer } = system(store);

			const { firstResult, secondResult } = await interleave(
				store,
				{ user: ALICE, start: () => answer(ALICE, APPROVED) },
				{ start: () => answer(BOB, REFUSED) }
			);

			// Both were accepted, the refusal first: the stale approval then won, and the sharing followed it.
			expect(firstResult.error).toBeUndefined();
			expect(secondResult.error).toBeUndefined();
			expect(store.commits.map(([who]) => who)).toEqual([BOB.id, ALICE.id]);
			expect(store.request.status).toBe(APPROVED);
			expect(store.documents['equipment-sharing'].status).toBe(APPROVED);
			expect(store.employeeSlots.find((slot) => slot.id === 'slot-bob').status).toBe(REFUSED);
		});

		it('a refusal saved first stands: the approval waiting on the lock gets 409, and the sharing stays refused', async () => {
			const store = new Store(requestRow());
			const { answer } = system(store);

			const { firstResult, secondResult, lockedWhilePaused } = await interleave(
				store,
				{ user: BOB, start: () => answer(BOB, REFUSED) },
				{ start: () => answer(ALICE, APPROVED) }
			);

			// Alice's approval waited for Bob's transaction to end before it could read the request.
			expect(lockedWhilePaused).toEqual([BOB.id]);
			expect(firstResult.error).toBeUndefined();
			expect(secondResult.error).toBeInstanceOf(ConflictException);
			expect(store.commits).toEqual([
				[BOB.id, `equipment:${REFUSED}`, `slot:slot-bob:${REFUSED}`, `request:${REFUSED}`]
			]);
			expect(store.request.status).toBe(REFUSED);
			expect(store.documents['equipment-sharing'].status).toBe(REFUSED);
			expect(store.employeeSlots.find((slot) => slot.id === 'slot-alice').status).toBe(REQUESTED);
		});

		it('an approval saved first stands: the refusal waiting on the lock gets 409, and the sharing stays approved', async () => {
			const store = new Store(requestRow());
			const { answer } = system(store);

			const { firstResult, secondResult, lockedWhilePaused } = await interleave(
				store,
				{ user: ALICE, start: () => answer(ALICE, APPROVED) },
				{ start: () => answer(BOB, REFUSED) }
			);

			expect(lockedWhilePaused).toEqual([ALICE.id]);
			expect(firstResult.error).toBeUndefined();
			expect(secondResult.error).toBeInstanceOf(ConflictException);
			expect(store.request.status).toBe(APPROVED);
			expect(store.documents['equipment-sharing'].status).toBe(APPROVED);
			expect(store.employeeSlots.find((slot) => slot.id === 'slot-bob').status).toBe(REQUESTED);
		});
	});

	describe('two approvals of a request that needs two', () => {
		it('CONTROL: without the row lock, each counts one and the request stays open with both approvals', async () => {
			const store = new Store(requestRow({ min_count: 2 }), false);
			const { answer } = system(store);

			await interleave(
				store,
				{ user: ALICE, start: () => answer(ALICE, APPROVED) },
				{ start: () => answer(BOB, APPROVED) }
			);

			expect(store.employeeSlots.map((slot) => slot.status)).toEqual([APPROVED, APPROVED]);
			expect(store.request.status).toBe(REQUESTED);
			expect(store.documents['equipment-sharing'].status).toBe(REQUESTED);
		});

		it('with the row lock, the second counts both: the request is approved and the sharing moves once', async () => {
			const store = new Store(requestRow({ min_count: 2 }));
			const { answer } = system(store);

			const { firstResult, secondResult } = await interleave(
				store,
				{ user: ALICE, start: () => answer(ALICE, APPROVED) },
				{ start: () => answer(BOB, APPROVED) }
			);

			expect(firstResult.value.status).toBe(REQUESTED);
			expect(secondResult.value.status).toBe(APPROVED);
			expect(store.commits).toEqual([
				[ALICE.id, `slot:slot-alice:${APPROVED}`],
				[BOB.id, `equipment:${APPROVED}`, `slot:slot-bob:${APPROVED}`, `request:${APPROVED}`]
			]);
			expect(store.request.status).toBe(APPROVED);
			expect(store.documents['equipment-sharing'].status).toBe(APPROVED);
		});
	});

	describe('a tenant administrator and an approver at the same time', () => {
		it("the administrator's refusal saved first stands: the approval gets 409, and the sharing is refused", async () => {
			const store = new Store(requestRow());
			const { answer } = system(store);

			const { firstResult, secondResult } = await interleave(
				store,
				{ user: ADMIN, start: () => answer(ADMIN, REFUSED) },
				{ start: () => answer(ALICE, APPROVED) }
			);

			expect(firstResult.error).toBeUndefined();
			expect(secondResult.error).toBeInstanceOf(ConflictException);
			expect(store.request.status).toBe(REFUSED);
			expect(store.documents['equipment-sharing'].status).toBe(REFUSED);
		});

		it("an administrator deciding the other way, behind an approver's approval, moves the sharing with the request", async () => {
			const store = new Store(requestRow());
			const { answer } = system(store);

			const { firstResult, secondResult } = await interleave(
				store,
				{ user: ALICE, start: () => answer(ALICE, APPROVED) },
				{ start: () => answer(ADMIN, REFUSED) }
			);

			expect(firstResult.error).toBeUndefined();
			expect(secondResult.error).toBeUndefined();
			expect(store.request.status).toBe(REFUSED);
			expect(store.documents['equipment-sharing'].status).toBe(REFUSED);
		});

		it("on a leave, an administrator's approval behind another's refusal gets 409: request and leave stay refused", async () => {
			const store = new Store(
				requestRow({ requestType: ApprovalPolicyTypesStringEnum.TIME_OFF, requestId: 'time-off-1' })
			);
			const { answer } = system(store);
			// A leave is decided only behind the time-off route's own gate, which asks for the administrator role.
			const otherAdmin: IFixtureUser = { ...ADMIN, id: 'user-admin-2' };

			const { firstResult, secondResult } = await interleave(
				store,
				{ user: otherAdmin, start: () => answer(otherAdmin, REFUSED) },
				{ start: () => answer(ADMIN, APPROVED) }
			);

			expect(firstResult.error).toBeUndefined();
			expect(secondResult.error).toBeInstanceOf(ConflictException);
			expect(store.commits).toEqual([['user-admin-2', 'time-off:DENIED', `request:${REFUSED}`]]);
			expect(store.request.status).toBe(REFUSED);
			expect(store.documents['time-off'].status).toBe('DENIED');
		});
	});

	describe('a request moved to another organization after the scoped read', () => {
		/** The scoped read finds the request in the caller's organization; an administrator then moves it. */
		function moveAfterTheScopedRead(store: Store, service: RequestApprovalService) {
			jest.spyOn(service, 'findOneByIdString').mockImplementationOnce(async () => {
				const scoped = copy(store.request);
				store.request.organizationId = 'organization-b';
				return scoped as any;
			});
		}

		it('is not found by an approver confined to their organization, and nothing is written', async () => {
			const store = new Store(requestRow());
			const { answer, service } = system(store);
			moveAfterTheScopedRead(store, service);

			const { error } = await answer(ALICE, APPROVED);

			expect(error).toBeInstanceOf(NotFoundException);
			expect(store.commits).toEqual([]);
			expect(store.request.status).toBe(REQUESTED);
			expect(store.documents['equipment-sharing'].status).toBe(REQUESTED);
			expect(store.employeeSlots.find((slot) => slot.id === 'slot-alice').status).toBe(REQUESTED);
		});

		it('is still answered by a tenant administrator, whom no organization confines', async () => {
			const store = new Store(requestRow());
			const { answer, service } = system(store);
			moveAfterTheScopedRead(store, service);

			const { error } = await answer(ADMIN, REFUSED);

			expect(error).toBeUndefined();
			expect(store.request.status).toBe(REFUSED);
		});
	});

	describe('the time-off route deciding the leave while an answer runs, on MySQL (REPEATABLE READ)', () => {
		const leaveRequest = () =>
			requestRow({ requestType: ApprovalPolicyTypesStringEnum.TIME_OFF, requestId: 'time-off-1' });

		/** Runs the administrator's answer; the time-off route commits `leaveStatus` after its snapshot is taken. */
		async function answerWhileTheLeaveIsDecided(status: number, leaveStatus: string) {
			const store = new Store(leaveRequest(), true, true);
			const { answer } = system(store);
			const pause = deferred();
			store.pauses.set(ADMIN.id, pause.promise);

			const answering = answer(ADMIN, status);
			await settle();
			store.documents['time-off'].status = leaveStatus;
			pause.resolve();

			return { store, result: await answering };
		}

		it('CONTROL: a plain read there still shows the leave as the snapshot had it, a locking read the decision', async () => {
			const store = new Store(leaveRequest(), true, true);

			const [plain, locked] = await store.transaction(async (transaction) => {
				await transaction.readSlots('approval-1', TENANT);
				store.documents['time-off'].status = 'DENIED';
				return [
					await transaction.readLinkedDocument('time-off', 'time-off-1', TENANT),
					await transaction.readLinkedDocument('time-off', 'time-off-1', TENANT, true)
				];
			});

			expect(plain?.status).toBe('REQUESTED');
			expect(locked?.status).toBe('DENIED');
		});

		it('the same decision is tolerated: the leave is read again under a row lock after the compare-and-set', async () => {
			const { store, result } = await answerWhileTheLeaveIsDecided(REFUSED, 'DENIED');

			expect(result.error).toBeUndefined();
			expect(store.commits).toEqual([[ADMIN.id, `request:${REFUSED}`]]);
			expect(store.request.status).toBe(REFUSED);
			expect(store.documents['time-off'].status).toBe('DENIED');
		});

		it('a decision the other way is still a conflict, and nothing is written', async () => {
			const { store, result } = await answerWhileTheLeaveIsDecided(REFUSED, 'APPROVED');

			expect(result.error).toBeInstanceOf(ConflictException);
			expect(store.commits).toEqual([]);
			expect(store.request.status).toBe(REQUESTED);
			expect(store.documents['time-off'].status).toBe('APPROVED');
		});

		it('a sharing moved to another organization after the snapshot is not found: it is read under a row lock', async () => {
			const store = new Store(requestRow(), true, true);
			const { answer } = system(store);
			const pause = deferred();
			store.pauses.set(ALICE.id, pause.promise);

			const answering = answer(ALICE, APPROVED);
			await settle();
			// An administrator moves the sharing out of Alice's organization once her snapshot is taken.
			store.documents['equipment-sharing'].organizationId = 'organization-b';
			pause.resolve();
			const { error } = await answering;

			expect(error).toBeInstanceOf(NotFoundException);
			expect(store.commits).toEqual([]);
			expect(store.documents['equipment-sharing'].status).toBe(REQUESTED);
		});
	});

	it('a refused answer writes nothing and releases the lock: the next approver answers the untouched request', async () => {
		const store = new Store(requestRow());
		const { answer } = system(store);

		const { firstResult, secondResult } = await interleave(
			store,
			{ user: ALICE_WITHOUT_GRANT, start: () => answer(ALICE_WITHOUT_GRANT, APPROVED) },
			{ start: () => answer(BOB, APPROVED) }
		);

		expect(firstResult.error).toBeInstanceOf(ForbiddenException);
		expect(secondResult.error).toBeUndefined();
		expect(store.commits).toEqual([
			[BOB.id, `equipment:${APPROVED}`, `slot:slot-bob:${APPROVED}`, `request:${APPROVED}`]
		]);
		expect(store.employeeSlots.find((slot) => slot.id === 'slot-alice').status).toBe(REQUESTED);
	});
});

describe('the answer transaction on each ORM', () => {
	const request = () => ({
		id: 'approval-1',
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		status: REQUESTED,
		min_count: 1,
		createdByUserId: 'user-requester',
		requestType: ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING,
		requestId: 'sharing-1'
	});
	const sharing = () => ({ id: 'sharing-1', tenantId: TENANT, organizationId: ORGANIZATION, status: REQUESTED });
	/** A request about a leave, which the time-off route has already denied: the compare-and-set moves nothing. */
	const leaveRequest = () => ({
		...request(),
		requestType: ApprovalPolicyTypesStringEnum.TIME_OFF,
		requestId: 'time-off-1'
	});
	const deniedLeave = () => ({ id: 'time-off-1', tenantId: TENANT, organizationId: ORGANIZATION, status: 'DENIED' });

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(contextUser(ALICE));
	});
	afterEach(() => {
		jest.restoreAllMocks();
		(isPostgres as jest.Mock).mockReturnValue(false);
		(isMySQL as jest.Mock).mockReturnValue(false);
	});

	describe('TypeORM', () => {
		function typeOrm({ leave = false }: { leave?: boolean } = {}) {
			const answered = () => (leave ? leaveRequest() : request());
			const query = {
				where: jest.fn().mockReturnThis(),
				setLock: jest.fn().mockReturnThis(),
				getOne: jest.fn(async () => answered())
			};
			const manager = {
				createQueryBuilder: jest.fn(() => query),
				find: jest.fn(async (entity: unknown) =>
					entity === RequestApprovalEmployee
						? [{ id: 'slot-alice', employeeId: ALICE.employeeId, status: REQUESTED }]
						: []
				),
				findOne: jest.fn(async (entity: unknown, ..._args: unknown[]) =>
					entity === EquipmentSharing ? sharing() : entity === TimeOffRequest ? deniedLeave() : null
				),
				update: jest.fn(async (entity: unknown, ..._args: unknown[]) => ({
					affected: entity === TimeOffRequest ? 0 : 1
				}))
			};
			const repository = { manager: { transaction: jest.fn(async (work: any) => await work(manager)) } };
			const service = new RequestApprovalService(
				repository as any,
				...(Array.from({ length: 7 }, () => ({})) as [any, any, any, any, any, any, any])
			);
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			jest.spyOn(service, 'findOneByIdString').mockResolvedValue(answered() as any);
			const update = jest.spyOn(service, 'update');
			const handler = new RequestApprovalStatusHandler(service);
			return { handler, manager, query, repository, update };
		}

		it.each([
			['PostgreSQL', isPostgres],
			['MySQL', isMySQL]
		])(
			'on %s reads the request FOR UPDATE, and reads and writes everything on the transaction',
			async (_, dialect) => {
				(dialect as jest.Mock).mockReturnValue(true);
				const { handler, manager, query, repository, update } = typeOrm();

				await handler.execute(new RequestApprovalStatusCommand('approval-1', APPROVED));

				expect(repository.manager.transaction).toHaveBeenCalledTimes(1);
				expect(manager.createQueryBuilder).toHaveBeenCalledWith(RequestApproval, 'request_approval');
				expect(query.where).toHaveBeenCalledWith({ id: 'approval-1', tenantId: TENANT });
				expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
				expect(manager.find).toHaveBeenCalledWith(RequestApprovalEmployee, {
					where: { requestApprovalId: 'approval-1', tenantId: TENANT }
				});
				expect(manager.find).toHaveBeenCalledWith(RequestApprovalTeam, {
					where: { requestApprovalId: 'approval-1', tenantId: TENANT }
				});
				expect(manager.update.mock.calls).toEqual([
					[EquipmentSharing, { id: 'sharing-1', tenantId: TENANT }, { status: APPROVED }],
					[
						RequestApprovalEmployee,
						{ id: In(['slot-alice']), tenantId: TENANT },
						{ status: APPROVED, updatedByUserId: ALICE.id }
					],
					[RequestApproval, { id: 'approval-1', tenantId: TENANT }, { status: APPROVED }]
				]);
				// The service's own update runs on another connection, which would wait on this transaction's lock.
				expect(update).not.toHaveBeenCalled();
			}
		);

		it('on SQLite takes no row lock: the transaction is serialized there', async () => {
			const { handler, query } = typeOrm();

			await handler.execute(new RequestApprovalStatusCommand('approval-1', APPROVED));

			expect(query.setLock).not.toHaveBeenCalled();
			expect(query.getOne).toHaveBeenCalledTimes(1);
		});

		it('on MySQL reads the leave under a row lock, without its eager relations, before and after the CAS', async () => {
			(isMySQL as jest.Mock).mockReturnValue(true);
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue(contextUser(ADMIN));
			const { handler, manager } = typeOrm({ leave: true });

			await handler.execute(new RequestApprovalStatusCommand('approval-1', REFUSED));

			// Its read for the scope check, then its reread after a compare-and-set that moved nothing.
			const read = {
				where: { id: 'time-off-1', tenantId: TENANT },
				loadEagerRelations: false,
				lock: { mode: 'pessimistic_write' }
			};
			expect(manager.findOne.mock.calls).toEqual([
				[TimeOffRequest, read],
				[TimeOffRequest, read]
			]);
		});

		it('on SQLite reads the linked document with no lock, and without its eager relations', async () => {
			const { handler, manager } = typeOrm();

			await handler.execute(new RequestApprovalStatusCommand('approval-1', APPROVED));

			expect(manager.findOne).toHaveBeenCalledWith(EquipmentSharing, {
				where: { id: 'sharing-1', tenantId: TENANT },
				loadEagerRelations: false
			});
		});
	});

	describe('MikroORM', () => {
		const NOW = new Date('2026-10-24T00:00:00.000Z');

		/** The audit mirror as the platform's entities map it under MikroORM: `persist: false`, beside its relation. */
		const auditedMeta = {
			props: [{ name: 'updatedByUserId', persist: false }],
			properties: {
				updatedByUserId: { name: 'updatedByUserId', persist: false, fieldNames: ['updatedByUserId'] }
			}
		};

		function mikroOrm({
			versionedSharing = false,
			leave = false,
			audited = false
		}: { versionedSharing?: boolean; leave?: boolean; audited?: boolean } = {}) {
			const answered = () => (leave ? leaveRequest() : request());
			const em = {
				findOne: jest.fn(async (entity: unknown, ..._args: unknown[]) =>
					entity === RequestApproval
						? answered()
						: entity === EquipmentSharing
							? sharing()
							: entity === TimeOffRequest
								? deniedLeave()
								: null
				),
				find: jest.fn(async (entity: unknown) =>
					entity === RequestApprovalEmployee
						? [{ id: 'slot-alice', employee: { id: ALICE.employeeId }, status: REQUESTED }]
						: []
				),
				nativeUpdate: jest.fn(async (entity: unknown, ..._args: unknown[]) =>
					entity === TimeOffRequest ? 0 : 1
				),
				getMetadata: () => ({
					find: (name: string) =>
						versionedSharing && name === EquipmentSharing.name
							? {
									props: [{ name: 'updatedAt', onUpdate: () => NOW }],
									properties: { version: { name: 'version', fieldNames: ['version'] } }
								}
							: audited
								? auditedMeta
								: undefined
				})
			};
			const typeOrmRepository = {
				manager: {
					connection: {
						hasMetadata: (entity: unknown) => versionedSharing && entity === EquipmentSharing,
						getMetadata: () => ({ versionColumn: { propertyName: 'version' } })
					}
				}
			};
			const mikroOrmRepository = {
				getEntityManager: () => ({ transactional: jest.fn(async (work: any) => work(em)) })
			};
			const service = new RequestApprovalService(
				typeOrmRepository as any,
				mikroOrmRepository as any,
				...(Array.from({ length: 6 }, () => ({})) as [any, any, any, any, any, any])
			);
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
			jest.spyOn(service, 'findOneByIdString').mockResolvedValue(answered() as any);
			jest.spyOn(service as any, 'serialize').mockImplementation((row: any) => ({ ...row }));
			const handler = new RequestApprovalStatusHandler(service);
			return { handler, em };
		}

		it.each([
			['PostgreSQL', isPostgres],
			['MySQL', isMySQL]
		])('on %s reads the request with PESSIMISTIC_WRITE, from the table, on the transaction', async (_, dialect) => {
			(dialect as jest.Mock).mockReturnValue(true);
			const { handler, em } = mikroOrm();

			await handler.execute(new RequestApprovalStatusCommand('approval-1', APPROVED));

			expect(em.findOne).toHaveBeenCalledWith(
				RequestApproval,
				{ id: 'approval-1', tenantId: TENANT },
				{ disableIdentityMap: true, lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			expect(em.find).toHaveBeenCalledWith(
				RequestApprovalEmployee,
				{ requestApproval: 'approval-1', tenantId: TENANT },
				{ disableIdentityMap: true }
			);
			expect(em.nativeUpdate.mock.calls).toEqual([
				[EquipmentSharing, { id: 'sharing-1', tenantId: TENANT }, { status: APPROVED }],
				[
					RequestApprovalEmployee,
					{ id: { $in: ['slot-alice'] }, tenantId: TENANT },
					{ status: APPROVED, updatedByUserId: ALICE.id }
				],
				[RequestApproval, { id: 'approval-1', tenantId: TENANT }, { status: APPROVED }]
			]);
		});

		it('on SQLite takes no lock mode: the transaction is serialized there', async () => {
			const { handler, em } = mikroOrm();

			await handler.execute(new RequestApprovalStatusCommand('approval-1', APPROVED));

			expect(em.findOne).toHaveBeenCalledWith(
				RequestApproval,
				{ id: 'approval-1', tenantId: TENANT },
				{ disableIdentityMap: true }
			);
		});

		it('moves a versioned document on: the update date is stamped and the version incremented in the statement', async () => {
			const { handler, em } = mikroOrm({ versionedSharing: true });

			await handler.execute(new RequestApprovalStatusCommand('approval-1', APPROVED));

			const [, where, row] = em.nativeUpdate.mock.calls.find(([entity]) => entity === EquipmentSharing) as [
				unknown,
				unknown,
				Record<string, any>
			];
			expect(where).toEqual({ id: 'sharing-1', tenantId: TENANT });
			expect(row).toMatchObject({ status: APPROVED, updatedAt: NOW });
			expect(row.version).toMatchObject({ sql: '?? + 1', params: ['version'] });
		});

		it('stamps the answering user on every write, through the `persist: false` audit mirror', async () => {
			const { handler, em } = mikroOrm({ audited: true });

			await handler.execute(new RequestApprovalStatusCommand('approval-1', APPROVED));

			expect(em.nativeUpdate.mock.calls.map(([entity, , row]) => [entity, row])).toEqual([
				[EquipmentSharing, { status: APPROVED, updatedByUserId: ALICE.id }],
				[RequestApprovalEmployee, { status: APPROVED, updatedByUserId: ALICE.id }],
				[RequestApproval, { status: APPROVED, updatedByUserId: ALICE.id }]
			]);
		});

		it('on MySQL reads the leave under a row lock, before and after a compare-and-set that moved nothing', async () => {
			(isMySQL as jest.Mock).mockReturnValue(true);
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue(contextUser(ADMIN));
			const { handler, em } = mikroOrm({ leave: true });

			await handler.execute(new RequestApprovalStatusCommand('approval-1', REFUSED));

			// MikroORM narrows the lock to the root table (`FOR UPDATE OF`) itself when an eager relation is joined.
			const read = [
				TimeOffRequest,
				{ id: 'time-off-1', tenantId: TENANT },
				{ disableIdentityMap: true, lockMode: LockMode.PESSIMISTIC_WRITE }
			];
			expect(em.findOne.mock.calls.filter(([entity]) => entity === TimeOffRequest)).toEqual([read, read]);
		});
	});
});
