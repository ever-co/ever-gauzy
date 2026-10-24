// Must stay first: loads the entity graph before the service pulls an entity.
import '../core/entities/internal';

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
 * The last blocks pin the statements each ORM arm sends.
 */

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: jest.fn(() => false),
	isMySQL: jest.fn(() => false)
}));

const { REQUESTED, APPROVED, REFUSED } = RequestApprovalStatusTypesEnum;

const TENANT = 'tenant-a';
const ORG = 'org-a';
const ID = 'sharing-1';

type Row = Record<string, any>;

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Lets every pending promise callback run, so a paused or blocked decision has gone as far as it can. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

function deferred() {
	let resolve: () => void = () => undefined;
	const promise = new Promise<void>((done) => (resolve = done));
	return { promise, resolve };
}

function asAdmin() {
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
		id: 'user-1',
		tenantId: TENANT,
		lastOrganizationId: ORG,
		role: { name: RolesEnum.ADMIN },
		permissions: []
	} as any);
}

/** One sharing, its request approval, and the decision's transaction over them. */
class Store {
	sharing: Row = { id: ID, tenantId: TENANT, organizationId: ORG, status: REQUESTED, version: 1 };
	approval: Row = { requestId: ID, tenantId: TENANT, status: REQUESTED };
	/** The first decision's pause after its sharing write, when set. */
	pauseAfterFirstWrite: Promise<void> | null = null;

	private lock: Promise<void> = Promise.resolve();

	constructor(private readonly atomic = true) {}

	async transaction<R>(work: (transaction: IEquipmentSharingDecisionTransaction) => Promise<R>): Promise<R> {
		const pending: Array<() => void> = [];
		let release = () => undefined as void;
		// In one transaction a write becomes visible at the commit; without one, at once.
		const write = (apply: () => void) => (this.atomic ? pending.push(apply) : apply());

		const transaction: IEquipmentSharingDecisionTransaction = {
			lockRequestApproval: async () => {
				if (!this.atomic) {
					return;
				}
				// FOR UPDATE: wait for the transaction holding the row, then hold it until this one ends.
				const held = this.lock;
				const next = deferred();
				this.lock = next.promise;
				release = next.resolve;
				await held;
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
			writeRequestApprovalStatus: async (_requestId, _tenantId, status) => {
				write(() => (this.approval = { ...this.approval, status }));
			}
		};

		try {
			const result = await work(transaction);
			// The commit: every write at once.
			pending.forEach((apply) => apply());
			return result;
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
		findOneByWhereOptions: jest.fn(async () => copy(store.approval)),
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

describe('the decision transaction on each ORM', () => {
	beforeEach(() => asAdmin());
	afterEach(() => {
		jest.restoreAllMocks();
		(isPostgres as jest.Mock).mockReturnValue(false);
		(isMySQL as jest.Mock).mockReturnValue(false);
	});

	const sharing = () => ({ id: ID, tenantId: TENANT, organizationId: ORG, status: REQUESTED, version: 2 });

	describe('TypeORM', () => {
		function typeOrm(affected = 1) {
			const query = {
				where: jest.fn().mockReturnThis(),
				setLock: jest.fn().mockReturnThis(),
				getMany: jest.fn(async () => [])
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
		])('on %s locks the request approval, then writes both rows on the transaction', async (_, dialect) => {
			(dialect as jest.Mock).mockReturnValue(true);
			const { service, manager, query, typeOrmRepository } = typeOrm();

			await service.decideWithRequestApproval(ID, APPROVED);

			expect(typeOrmRepository.manager.transaction).toHaveBeenCalledTimes(1);
			expect(manager.createQueryBuilder).toHaveBeenCalledWith(RequestApproval, 'request_approval');
			expect(query.where).toHaveBeenCalledWith({ requestId: ID, tenantId: TENANT });
			expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
			expect(manager.update.mock.calls).toEqual([
				[EquipmentSharing, { id: ID, version: 2, tenantId: TENANT }, { status: APPROVED }],
				[RequestApproval, { requestId: ID, tenantId: TENANT }, { status: APPROVED }]
			]);
		});

		it('on SQLite takes no row lock: the transaction is serialized there', async () => {
			const { service, query } = typeOrm();

			await service.decideWithRequestApproval(ID, APPROVED);

			expect(query.setLock).not.toHaveBeenCalled();
		});

		it('writes no approval when the compare-and-set matched nothing, and answers 409 with both versions', async () => {
			const { service, manager } = typeOrm(0);

			const error = await service.decideWithRequestApproval(ID, APPROVED).catch((reason) => reason);

			expect(error).toBeInstanceOf(ApiException);
			expect(error.getStatus()).toBe(409);
			expect(error.details).toEqual({ id: ID, expectedVersion: 2, actualVersion: 3 });
			expect(manager.update.mock.calls.map(([entity]) => entity)).toEqual([EquipmentSharing]);
		});
	});

	describe('MikroORM', () => {
		const NOW = new Date('2026-10-24T00:00:00.000Z');

		function mikroOrm(audited = false) {
			const em = {
				find: jest.fn(async (..._args: unknown[]) => []),
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
		])('on %s locks the request approval with PESSIMISTIC_WRITE, then writes both rows', async (_, dialect) => {
			(dialect as jest.Mock).mockReturnValue(true);
			const { service, em, transactional } = mikroOrm();

			await service.decideWithRequestApproval(ID, APPROVED);

			expect(transactional).toHaveBeenCalledTimes(1);
			expect(em.find).toHaveBeenCalledWith(
				RequestApproval,
				{ requestId: ID, tenantId: TENANT },
				{ disableIdentityMap: true, lockMode: LockMode.PESSIMISTIC_WRITE }
			);
			expect(em.nativeUpdate.mock.calls).toEqual([
				[
					EquipmentSharing,
					{ id: ID, version: 2, tenantId: TENANT },
					{ status: APPROVED, version: 'version + 1' }
				],
				[RequestApproval, { requestId: ID, tenantId: TENANT }, { status: APPROVED }]
			]);
		});

		it('on SQLite takes no lock: the transaction is serialized there', async () => {
			const { service, em } = mikroOrm();

			await service.decideWithRequestApproval(ID, APPROVED);

			expect(em.find).not.toHaveBeenCalled();
		});

		it('stamps the update date and the deciding user on the approval, through its `persist: false` mirror', async () => {
			const { service, em } = mikroOrm(true);

			await service.decideWithRequestApproval(ID, REFUSED);

			const [, , row] = em.nativeUpdate.mock.calls.find(([entity]) => entity === RequestApproval) as [
				unknown,
				unknown,
				Record<string, unknown>
			];
			expect(row).toEqual({ status: REFUSED, updatedAt: NOW, updatedByUserId: 'user-1' });
		});
	});
});
