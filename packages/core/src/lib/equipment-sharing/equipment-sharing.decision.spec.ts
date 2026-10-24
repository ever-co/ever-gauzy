// Must stay first: loads the entity graph before the service pulls an entity.
import '../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { LockMode } from '@mikro-orm/core';
import { isMySQL, isPostgres } from '@gauzy/config';
import { RequestApprovalStatusTypesEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { RequestApproval } from '../core/entities/internal';
import { ApiException } from '../core/errors/api-exception';
import { MultiORMEnum } from '../core/utils';
import { EquipmentSharingStatusCommand } from './commands/equipment-sharing.status.command';
import { EquipmentSharingStatusHandler } from './commands/handlers/equipment-sharing.status.handler';
import { EquipmentSharing } from './equipment-sharing.entity';
import { EquipmentSharingService, IEquipmentSharingDecisionTransaction } from './equipment-sharing.service';

/**
 * `PUT /equipment-sharing/approval|refuse/:id` (and the GraphQL approve / refuse) decide the sharing and its request
 * approval. The two writes were separate statements: the sharing's compare-and-set, then the approval's update. The
 * sharing's new version was visible before the approval was written, so a decision that approved the sharing and
 * paused there let a refusal read that version, refuse the sharing and its approval — and the approval then wrote
 * APPROVED over the refusal: the sharing refused, its approval approved.
 *
 * Both writes are now one transaction that first locks the request approval's row (`SELECT … FOR UPDATE`), and whose
 * compare-and-set holds the sharing's row. The store below has what the service relies on from PostgreSQL and MySQL:
 * the lock holds until the transaction ends, a compare-and-set reads what is committed, and the writes become visible
 * at the commit. Its `atomic: false` mode is the old behaviour (each write committed on its own, no lock), kept as
 * the control that shows the race is real. The interleaving is forced: the first decision pauses after its sharing
 * write.
 *
 * The approval the transaction locks and writes is the sharing's own, by its id (second block); the last blocks pin
 * the statements each ORM arm sends.
 */

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: jest.fn(() => false),
	isMySQL: jest.fn(() => false)
}));

const { REQUESTED, APPROVED, REFUSED } = RequestApprovalStatusTypesEnum;

const TENANT = 'tenant-a';
const ORG = 'org-a';
const OTHER_ORG = 'org-b';
const ID = 'sharing-1';
const APPROVAL_ID = 'approval-1';

type Row = Record<string, any>;

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Lets every pending promise callback run, so a paused or blocked decision has gone as far as it can. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

function deferred() {
	let resolve: () => void = () => undefined;
	const promise = new Promise<void>((done) => (resolve = done));
	return { promise, resolve };
}

function asUser(role: RolesEnum = RolesEnum.ADMIN, organizationId = ORG) {
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
		id: 'user-1',
		tenantId: TENANT,
		lastOrganizationId: organizationId,
		role: { name: role },
		permissions: []
	} as any);
}

const asAdmin = () => asUser(RolesEnum.ADMIN);

/** One sharing, the request approvals of the tenant, and the decision's transaction over them. */
class Store {
	sharing: Row = { id: ID, tenantId: TENANT, organizationId: ORG, status: REQUESTED, version: 1 };
	/** The request approvals, by id: the sharing's own, and any other the test adds. */
	approvals: Record<string, Row> = {
		[APPROVAL_ID]: { id: APPROVAL_ID, requestId: ID, tenantId: TENANT, organizationId: ORG, status: REQUESTED }
	};
	/** The first decision's pause after its sharing write, when set. */
	pauseAfterFirstWrite: Promise<void> | null = null;
	/** Whether the last transaction committed (`false` when it rolled back). */
	committed: boolean | null = null;
	/**
	 * Another write landing once the next transaction is entered: after every read the decision makes before it
	 * (the handler's and the service's own), before the transaction's first statement.
	 */
	atTransactionEntry: (() => void) | null = null;

	private lock: Promise<void> = Promise.resolve();

	constructor(private readonly atomic = true) {}

	/** The sharing's own request approval. */
	get approval(): Row {
		return this.approvals[APPROVAL_ID];
	}

	async transaction<R>(work: (transaction: IEquipmentSharingDecisionTransaction) => Promise<R>): Promise<R> {
		const landing = this.atTransactionEntry;
		this.atTransactionEntry = null;
		landing?.();

		const pending: Array<() => void> = [];
		let release = () => undefined as void;
		// In one transaction a write becomes visible at the commit; without one, at once.
		const write = (apply: () => void) => (this.atomic ? pending.push(apply) : apply());

		const transaction: IEquipmentSharingDecisionTransaction = {
			lockRequestApproval: async (requestApprovalId) => {
				if (this.atomic) {
					// FOR UPDATE: wait for the transaction holding the row, then hold it until this one ends.
					const held = this.lock;
					const next = deferred();
					this.lock = next.promise;
					release = next.resolve;
					await held;
				}
				// A locking read answers what is committed.
				const row = this.approvals[requestApprovalId];
				return row ? copy({ id: row.id, requestId: row.requestId, organizationId: row.organizationId }) : null;
			},
			writeSharingStatus: async (criteria: Row, status) => {
				// An UPDATE's compare-and-set reads what is committed.
				const stale = 'version' in criteria && criteria.version !== this.sharing.version;
				if (criteria.id !== this.sharing.id || stale) {
					return 0;
				}
				write(() => (this.sharing = { ...this.sharing, status, version: this.sharing.version + 1 }));
				const pause = this.pauseAfterFirstWrite;
				this.pauseAfterFirstWrite = null;
				await pause;
				return 1;
			},
			writeRequestApprovalStatus: async (requestApprovalId, _tenantId, status) => {
				write(() => {
					if (this.approvals[requestApprovalId]) {
						this.approvals[requestApprovalId] = { ...this.approvals[requestApprovalId], status };
					}
				});
			}
		};

		try {
			const result = await work(transaction);
			// The commit: every write at once.
			pending.forEach((apply) => apply());
			this.committed = true;
			return result;
		} catch (error) {
			// The rollback: nothing the transaction wrote is kept.
			this.committed = false;
			throw error;
		} finally {
			release();
		}
	}
}

/** The status handler over a service whose reads see what the store has committed. */
function system(store: Store) {
	const typeOrmRepository = {
		metadata: { tableName: 'equipment_sharing' },
		// The diagnostic read of a conflict.
		findOne: jest.fn(async () => copy(store.sharing))
	};
	const service = new EquipmentSharingService(
		typeOrmRepository as any,
		{} as any,
		{} as any,
		{ dbConnectionOptions: { type: 'postgres' } } as any
	);
	jest.spyOn(service, 'findOneByIdString').mockImplementation(async () => copy(store.sharing) as any);
	jest.spyOn(service as any, 'decisionTransaction').mockImplementation((work: any) => store.transaction(work));

	const approvals = {
		// The scoped read of the sharing's approval, as committed when it is made.
		findOneByWhereOptions: jest.fn(async (where: Row) => {
			const row = Object.values(store.approvals).find((approval) =>
				Object.entries(where).every(([key, value]) => approval[key] === value)
			);
			if (!row) {
				throw new NotFoundException('The requested record was not found');
			}
			return copy(row);
		}),
		update: jest.fn()
	};
	const handler = new EquipmentSharingStatusHandler(service, approvals as any);
	const decide = (status: number) =>
		handler.execute(new EquipmentSharingStatusCommand(ID, status)).then(
			(value) => ({ value, error: undefined as unknown }),
			(error) => ({ value: undefined, error })
		);
	return { decide, approvals };
}

/** An approval that pauses after its sharing write, and a refusal started while it is paused. */
async function approvalPausedBeforeItsApprovalWrite(store: Store) {
	const { decide, approvals } = system(store);
	const pause = deferred();
	store.pauseAfterFirstWrite = pause.promise;

	const approving = decide(APPROVED);
	await settle();
	const refusing = decide(REFUSED);
	await settle();
	pause.resolve();

	const [approval, refusal] = await Promise.all([approving, refusing]);
	return { approval, refusal, approvals };
}

describe('deciding an equipment sharing writes it and its request approval in one transaction', () => {
	beforeEach(() => asAdmin());
	afterEach(() => jest.restoreAllMocks());

	it('CONTROL: as two writes, a refusal between them leaves the sharing refused and its approval approved', async () => {
		const store = new Store(false);

		const { approval, refusal } = await approvalPausedBeforeItsApprovalWrite(store);

		expect(approval.error).toBeUndefined();
		expect(refusal.error).toBeUndefined();
		expect(store.sharing).toMatchObject({ status: REFUSED, version: 3 });
		expect(store.approval.status).toBe(APPROVED);
	});

	it('a refusal read before the approval committed waits for it and gets 409: both rows stay approved', async () => {
		const store = new Store();

		const { approval, refusal, approvals } = await approvalPausedBeforeItsApprovalWrite(store);

		expect(approval.error).toBeUndefined();
		expect(refusal.error).toBeInstanceOf(ApiException);
		expect((refusal.error as ApiException).getStatus()).toBe(409);
		expect(store.sharing).toMatchObject({ status: APPROVED, version: 2 });
		expect(store.approval.status).toBe(APPROVED);
		// The approval is written on the transaction, never through the request approval service's own connection.
		expect(approvals.update).not.toHaveBeenCalled();
	});

	it('a refusal read after the approval committed decides both rows after it', async () => {
		const store = new Store();
		const { decide } = system(store);

		await decide(APPROVED);
		const { error } = await decide(REFUSED);

		expect(error).toBeUndefined();
		expect(store.sharing).toMatchObject({ status: REFUSED, version: 3 });
		expect(store.approval.status).toBe(REFUSED);
	});

	it('answers the sharing as decided, at the next version', async () => {
		const store = new Store();
		const { decide } = system(store);

		const { value } = await decide(APPROVED);

		expect(value).toMatchObject({ id: ID, status: APPROVED, version: 2 });
	});
});

/**
 * The request approval the decision writes. The transaction used to lock and write every approval whose `requestId`
 * named the sharing, inside the tenant, and to ignore whether any was there:
 *
 * - approvals of other organizations of the tenant can carry the same `requestId` (`POST /request-approval` stores
 *   the one it is given), and were decided with the sharing;
 * - the edit (`EquipmentSharingUpdateHandler`) removes the sharing and its approval, recreates the sharing at the next
 *   version and only then files its approval again, under a new id. A decision that read the recreated sharing and the
 *   approval the edit had removed passed the compare-and-set, wrote no approval (none matched) and committed a decided
 *   sharing, beside which the edit then filed a REQUESTED approval.
 *
 * The approval is now the one the handler read in the sharing's organization, locked and written by its own id, and
 * it must still be there, still be the sharing's and still be in the caller's reach under the lock.
 */
describe('the decision writes the sharing’s own request approval, and only while it is there', () => {
	afterEach(() => jest.restoreAllMocks());

	/** The handler's approval read, followed at once by another write (`change`) landing before the transaction. */
	function changedAfterTheApprovalRead(approvals: { findOneByWhereOptions: jest.Mock }, change: () => void) {
		const read = approvals.findOneByWhereOptions.getMockImplementation() as (where: Row) => Promise<Row>;
		approvals.findOneByWhereOptions.mockImplementationOnce(async (where: Row) => {
			const row = await read(where);
			change();
			return row;
		});
	}

	it('reads the approval in the sharing’s organization, and leaves another organization’s approval of the same request as it is', async () => {
		asAdmin();
		const store = new Store();
		// Another organization's approval naming the same sharing, stored first so a read by `requestId` alone finds it.
		store.approvals = {
			'approval-foreign': {
				id: 'approval-foreign',
				requestId: ID,
				tenantId: TENANT,
				organizationId: OTHER_ORG,
				status: REQUESTED
			},
			[APPROVAL_ID]: store.approval
		};
		const { decide, approvals } = system(store);

		const { error } = await decide(APPROVED);

		expect(error).toBeUndefined();
		expect(approvals.findOneByWhereOptions).toHaveBeenCalledWith({ requestId: ID, organizationId: ORG });
		expect(store.sharing.status).toBe(APPROVED);
		expect(store.approval.status).toBe(APPROVED);
		expect(store.approvals['approval-foreign'].status).toBe(REQUESTED);
	});

	it('CONTROL: an edit caught half way let the pre-fix statements commit a decided sharing with no approval written', async () => {
		asAdmin();
		const store = new Store();
		// The edit recreated the sharing at the next version and has not filed its approval again yet.
		store.sharing = { ...store.sharing, version: 2 };
		delete store.approvals[APPROVAL_ID];

		// The pre-fix transaction: the lock and the approval's write by `requestId`, which match nothing now.
		await store.transaction(async (transaction) => {
			await transaction.lockRequestApproval(APPROVAL_ID, TENANT);
			return await transaction.writeSharingStatus({ id: ID, version: 2, tenantId: TENANT } as Row, APPROVED);
		});

		expect(store.committed).toBe(true);
		expect(store.sharing).toMatchObject({ status: APPROVED, version: 3 });
		expect(Object.values(store.approvals)).toEqual([]);
	});

	it('an edit caught half way: the approval it removed is not there under the lock, and the decision writes nothing (404)', async () => {
		asAdmin();
		const store = new Store();
		// The edit recreated the sharing at the next version; the decision reads it, and the approval the edit is
		// about to remove.
		store.sharing = { ...store.sharing, version: 2 };
		const { decide, approvals } = system(store);
		changedAfterTheApprovalRead(approvals, () => delete store.approvals[APPROVAL_ID]);

		const { error } = await decide(APPROVED);

		expect(error).toBeInstanceOf(NotFoundException);
		expect(store.committed).toBe(false);
		expect(store.sharing).toMatchObject({ status: REQUESTED, version: 2 });
	});

	it('a decision based on a read another edit overtook is still told so (409) when that edit also replaced the approval', async () => {
		asAdmin();
		const store = new Store();
		const { decide, approvals } = system(store);
		// The whole edit lands after every read of the decision, the service's own included (version 1): the sharing
		// moves on, its approval is filed again under a new id.
		store.atTransactionEntry = () => {
			store.sharing = { ...store.sharing, version: 2 };
			delete store.approvals[APPROVAL_ID];
			store.approvals['approval-2'] = {
				id: 'approval-2',
				requestId: ID,
				tenantId: TENANT,
				organizationId: ORG,
				status: REQUESTED
			};
		};

		const { error } = await decide(APPROVED);

		expect(error).toBeInstanceOf(ApiException);
		expect((error as ApiException).getStatus()).toBe(409);
		expect((error as ApiException).details).toMatchObject({ expectedVersion: 1, actualVersion: 2 });
		expect(approvals.findOneByWhereOptions).toHaveBeenCalledTimes(1);
		expect(store.sharing).toMatchObject({ status: REQUESTED, version: 2 });
		expect(store.approvals['approval-2'].status).toBe(REQUESTED);
	});

	it('an edit that removed the approval after the decision’s reads, and has not moved the sharing yet, refuses it (404)', async () => {
		asAdmin();
		const store = new Store();
		const { decide } = system(store);
		// The edit's removal of the approval lands at the transaction's entry; the sharing is still at version 1.
		store.atTransactionEntry = () => delete store.approvals[APPROVAL_ID];

		const { error } = await decide(APPROVED);

		expect(error).toBeInstanceOf(NotFoundException);
		expect(store.committed).toBe(false);
		expect(store.sharing).toMatchObject({ status: REQUESTED, version: 1 });
	});

	it('refuses a tenant administrator too (404) when the approval was moved to another organization than the sharing’s', async () => {
		asAdmin();
		const store = new Store();
		const { decide } = system(store);
		// An administrator's boundary takes in every organization, and the move does not change the sharing's version:
		// only the comparison with the sharing's own organization sees it.
		store.atTransactionEntry = () => (store.approval.organizationId = OTHER_ORG);

		const { error } = await decide(APPROVED);

		expect(error).toBeInstanceOf(NotFoundException);
		expect(store.committed).toBe(false);
		expect(store.sharing).toMatchObject({ status: REQUESTED, version: 1 });
		expect(store.approval).toMatchObject({ organizationId: OTHER_ORG, status: REQUESTED });
	});

	it('refuses a confined caller (404) when the approval moved out of their organization under the lock', async () => {
		asUser(RolesEnum.MANAGER, ORG);
		const store = new Store();
		const { decide, approvals } = system(store);
		changedAfterTheApprovalRead(approvals, () => (store.approval.organizationId = OTHER_ORG));

		const { error } = await decide(APPROVED);

		expect(error).toBeInstanceOf(NotFoundException);
		expect(store.committed).toBe(false);
		expect(store.sharing.status).toBe(REQUESTED);
		expect(store.approval.status).toBe(REQUESTED);
	});

	it('refuses (404) when the approval was moved onto another request under the lock', async () => {
		asAdmin();
		const store = new Store();
		const { decide, approvals } = system(store);
		changedAfterTheApprovalRead(approvals, () => (store.approval.requestId = 'sharing-2'));

		const { error } = await decide(APPROVED);

		expect(error).toBeInstanceOf(NotFoundException);
		expect(store.sharing.status).toBe(REQUESTED);
	});
});

describe('the decision transaction on each ORM', () => {
	beforeEach(() => asAdmin());
	afterEach(() => {
		jest.restoreAllMocks();
		(isPostgres as jest.Mock).mockReturnValue(false);
		(isMySQL as jest.Mock).mockReturnValue(false);
	});

	const sharing = () => ({ id: ID, tenantId: TENANT, organizationId: ORG, status: REQUESTED, version: 2 });

	describe('TypeORM', () => {
		function typeOrm(affected = 1, approval: Row | null = { id: APPROVAL_ID, requestId: ID, organizationId: ORG }) {
			const query = {
				where: jest.fn().mockReturnThis(),
				setLock: jest.fn().mockReturnThis(),
				getOne: jest.fn(async () => approval)
			};
			const manager = {
				createQueryBuilder: jest.fn(() => query),
				update: jest.fn(async (entity: unknown, ..._args: unknown[]) => ({
					affected: entity === EquipmentSharing ? affected : 1
				}))
			};
			const typeOrmRepository = {
				metadata: { tableName: 'equipment_sharing' },
				findOne: jest.fn(async () => ({ ...sharing(), version: 3 })),
				manager: { transaction: jest.fn(async (work: any) => await work(manager)) }
			};
			const service = new EquipmentSharingService(
				typeOrmRepository as any,
				{} as any,
				{} as any,
				{ dbConnectionOptions: { type: 'postgres' } } as any
			);
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			jest.spyOn(service, 'findOneByIdString').mockResolvedValue(sharing() as any);
			return { service, manager, query, typeOrmRepository };
		}

		it.each([
			['PostgreSQL', isPostgres],
			['MySQL', isMySQL]
		])('on %s locks the approval by its id, then writes both rows on the transaction', async (_, dialect) => {
			(dialect as jest.Mock).mockReturnValue(true);
			const { service, manager, query, typeOrmRepository } = typeOrm();

			await service.decideWithRequestApproval(ID, APPROVED, APPROVAL_ID);

			expect(typeOrmRepository.manager.transaction).toHaveBeenCalledTimes(1);
			expect(manager.createQueryBuilder).toHaveBeenCalledWith(RequestApproval, 'request_approval');
			expect(query.where).toHaveBeenCalledWith({ id: APPROVAL_ID, tenantId: TENANT });
			expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
			expect(manager.update.mock.calls).toEqual([
				[EquipmentSharing, { id: ID, version: 2, tenantId: TENANT }, { status: APPROVED }],
				[RequestApproval, { id: APPROVAL_ID, tenantId: TENANT }, { status: APPROVED }]
			]);
		});

		it('on SQLite takes no row lock, and still reads the approval: the transaction is serialized there', async () => {
			const { service, query } = typeOrm();

			await service.decideWithRequestApproval(ID, APPROVED, APPROVAL_ID);

			expect(query.setLock).not.toHaveBeenCalled();
			expect(query.getOne).toHaveBeenCalledTimes(1);
		});

		it('writes no approval when the compare-and-set matched nothing, and answers 409 with both versions', async () => {
			const { service, manager } = typeOrm(0);

			const error = await service.decideWithRequestApproval(ID, APPROVED, APPROVAL_ID).catch((reason) => reason);

			expect(error).toBeInstanceOf(ApiException);
			expect(error.getStatus()).toBe(409);
			expect(error.details).toEqual({ id: ID, expectedVersion: 2, actualVersion: 3 });
			expect(manager.update.mock.calls.map(([entity]) => entity)).toEqual([EquipmentSharing]);
		});

		it.each([
			['PostgreSQL', isPostgres],
			['SQLite', null]
		])('on %s refuses (404) and fails the transaction when the approval is gone', async (_, dialect) => {
			if (dialect) {
				(dialect as jest.Mock).mockReturnValue(true);
			}
			const { service, manager, typeOrmRepository } = typeOrm(1, null);

			const error = await service.decideWithRequestApproval(ID, APPROVED, APPROVAL_ID).catch((reason) => reason);

			expect(error).toBeInstanceOf(NotFoundException);
			// Thrown out of the transaction's callback, which rolls the sharing's write back.
			await expect(typeOrmRepository.manager.transaction.mock.results[0].value).rejects.toBeInstanceOf(
				NotFoundException
			);
			expect(manager.update.mock.calls.map(([entity]) => entity)).toEqual([EquipmentSharing]);
		});
	});

	describe('MikroORM', () => {
		const NOW = new Date('2026-10-24T00:00:00.000Z');

		function mikroOrm(
			audited = false,
			approval: Row | null = { id: APPROVAL_ID, requestId: ID, organizationId: ORG }
		) {
			const em = {
				findOne: jest.fn(async (..._args: unknown[]) => approval),
				nativeUpdate: jest.fn(async (..._args: unknown[]) => 1),
				getMetadata: () => ({
					find: (name: string) =>
						audited && name === RequestApproval.name
							? {
									props: [{ name: 'updatedAt', onUpdate: () => NOW }],
									properties: { updatedByUserId: { name: 'updatedByUserId', persist: false } }
								}
							: undefined
				})
			};
			const transactional = jest.fn(async (work: any) => await work(em));
			const service = new EquipmentSharingService(
				{ metadata: { tableName: 'equipment_sharing' } } as any,
				{ getEntityManager: () => ({ transactional }) } as any,
				{} as any,
				{ dbConnectionOptions: { type: 'postgres' } } as any
			);
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
			jest.spyOn(service, 'findOneByIdString').mockResolvedValue(sharing() as any);
			// The sharing's row as `CrudService.update` writes it on MikroORM (its own spec pins the details).
			jest.spyOn(service as any, 'mikroOrmUpdateRow').mockImplementation((row: any) => ({
				...row,
				version: 'version + 1'
			}));
			return { service, em, transactional };
		}

		it.each([
			['PostgreSQL', isPostgres],
			['MySQL', isMySQL]
		])('on %s locks the approval by its id with PESSIMISTIC_WRITE, then writes both rows', async (_, dialect) => {
			(dialect as jest.Mock).mockReturnValue(true);
			const { service, em, transactional } = mikroOrm();

			await service.decideWithRequestApproval(ID, APPROVED, APPROVAL_ID);

			expect(transactional).toHaveBeenCalledTimes(1);
			expect(em.findOne).toHaveBeenCalledWith(
				RequestApproval,
				{ id: APPROVAL_ID, tenantId: TENANT },
				{ disableIdentityMap: true, lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			expect(em.nativeUpdate.mock.calls).toEqual([
				[
					EquipmentSharing,
					{ id: ID, version: 2, tenantId: TENANT },
					{ status: APPROVED, version: 'version + 1' }
				],
				[RequestApproval, { id: APPROVAL_ID, tenantId: TENANT }, { status: APPROVED }]
			]);
		});

		it('on SQLite takes no lock, and still reads the approval from the table: the transaction is serialized there', async () => {
			const { service, em } = mikroOrm();

			await service.decideWithRequestApproval(ID, APPROVED, APPROVAL_ID);

			expect(em.findOne).toHaveBeenCalledWith(
				RequestApproval,
				{ id: APPROVAL_ID, tenantId: TENANT },
				{ disableIdentityMap: true }
			);
		});

		it('refuses (404) and writes no approval when the approval is gone', async () => {
			const { service, em } = mikroOrm(false, null);

			const error = await service.decideWithRequestApproval(ID, APPROVED, APPROVAL_ID).catch((reason) => reason);

			expect(error).toBeInstanceOf(NotFoundException);
			expect(em.nativeUpdate.mock.calls.map(([entity]) => entity)).toEqual([EquipmentSharing]);
		});

		it('reads the approval’s organization off its relation when the `persist: false` mirror is not hydrated', async () => {
			asUser(RolesEnum.MANAGER, ORG);
			const { service, em } = mikroOrm(false, {
				id: APPROVAL_ID,
				requestId: ID,
				organization: { id: OTHER_ORG }
			});

			const error = await service.decideWithRequestApproval(ID, APPROVED, APPROVAL_ID).catch((reason) => reason);

			// The approval is another organization's: out of a confined manager's reach.
			expect(error).toBeInstanceOf(NotFoundException);
			expect(em.nativeUpdate.mock.calls.map(([entity]) => entity)).toEqual([EquipmentSharing]);
		});

		it.each([
			['the sharing’s', ORG, [EquipmentSharing, RequestApproval]],
			['another', OTHER_ORG, [EquipmentSharing]]
		])(
			'compares the approval’s organization, read off its relation, with the sharing’s: %s organization',
			async (_, organizationId, written) => {
				// A tenant administrator: no boundary, so only the comparison with the sharing's organization decides.
				const approval = { id: APPROVAL_ID, requestId: ID, organization: { id: organizationId } };
				const { service, em } = mikroOrm(false, approval);

				const error = await service.decideWithRequestApproval(ID, APPROVED, APPROVAL_ID).then(
					() => undefined,
					(reason) => reason
				);

				expect(error === undefined).toBe(organizationId === ORG);
				expect(em.nativeUpdate.mock.calls.map(([entity]) => entity)).toEqual(written);
			}
		);

		it('stamps the update date and the deciding user on the approval, through its `persist: false` mirror', async () => {
			const { service, em } = mikroOrm(true);

			await service.decideWithRequestApproval(ID, REFUSED, APPROVAL_ID);

			const [, , row] = em.nativeUpdate.mock.calls.find(([entity]) => entity === RequestApproval) as [
				unknown,
				unknown,
				Record<string, unknown>
			];
			expect(row).toEqual({ status: REFUSED, updatedAt: NOW, updatedByUserId: 'user-1' });
		});
	});
});
