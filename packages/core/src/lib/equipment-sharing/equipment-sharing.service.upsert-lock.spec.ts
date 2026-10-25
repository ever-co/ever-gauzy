// Must stay first: loads the entity graph before the service pulls an entity.
import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { isMySQL, isPostgres } from '@gauzy/config';
import { ApprovalPolicyTypesStringEnum, RequestApprovalStatusTypesEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestApproval } from '../core/entities/internal';
import { ApiException } from '../core/errors/api-exception';
import { MultiORMEnum } from '../core/utils';
import { EquipmentSharing } from './equipment-sharing.entity';
import { EquipmentSharingService, IEquipmentSharingInPlaceTransaction } from './equipment-sharing.service';

/**
 * The generic `POST /equipment-sharing` upsert (the CRUD base's `create()` with a body id) could change a stored
 * sharing's memberships without the lock the in-place edit takes — the gap #11413 left documented. A decision of the
 * sharing (`decideWithRequestApproval`, or the request approval's answer) locks the approval and then reads who the
 * sharing is for: the upsert, writing the employees and the teams on its own connection, could replace them while the
 * decision read them, so the decision could stand on requesters that no longer stood.
 *
 * Such an upsert is now written the way `updateInPlace` writes its edit: in one transaction, the sharing's request
 * approval is locked first (approval, then sharing — the decisions' order), the columns are written in one statement
 * predicated on the version, and the memberships are replaced. Every other upsert is stored as before.
 *
 * The store below commits a transaction's writes when its body returns and drops them when it throws; the last block
 * pins the statements the TypeORM arm sends.
 */

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: jest.fn(() => false),
	isMySQL: jest.fn(() => false)
}));

const { REQUESTED } = RequestApprovalStatusTypesEnum;

const TENANT = 'tenant-a';
const ORG = 'org-a';
const OTHER_ORG = 'org-b';
const ID = 'sharing-1';
const EQUIPMENT = 'equipment-1';
const EMPLOYEE_1 = 'employee-1';
const EMPLOYEE_2 = 'employee-2';

type Row = Record<string, any>;

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Lets every pending promise callback run, so a blocked upsert has gone as far as it can. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

function deferred() {
	let resolve: () => void = () => undefined;
	const promise = new Promise<void>((done) => (resolve = done));
	return { promise, resolve };
}

function asUser(role: RolesEnum = RolesEnum.ADMIN) {
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
		id: 'user-1',
		tenantId: TENANT,
		lastOrganizationId: ORG,
		role: { name: role },
		permissions: []
	} as any);
}

/** One stored sharing with its memberships, and the in-place transaction over it. */
class Store {
	sharing: Row = {
		id: ID,
		tenantId: TENANT,
		organizationId: ORG,
		name: 'Projector',
		status: REQUESTED,
		equipmentId: EQUIPMENT,
		equipmentSharingPolicyId: null,
		version: 1,
		deletedAt: null,
		employees: [EMPLOYEE_1],
		teams: ['team-1']
	};
	/** What the transaction was asked to do, in order. */
	statements: Array<[string, ...unknown[]]> = [];
	/** Makes the memberships' replacement fail, to show the rollback. */
	failMembers = false;
	/** The approval's row lock, while another transaction (a decision, an answer) holds it. */
	approvalHeld: Promise<void> | null = null;

	async transaction<R>(work: (transaction: IEquipmentSharingInPlaceTransaction) => Promise<R>): Promise<R> {
		const pending: Array<() => void> = [];
		const transaction: IEquipmentSharingInPlaceTransaction = {
			lockApprovals: async (sharingId, tenantId, organizationId) => {
				this.statements.push(['lockApprovals', sharingId, tenantId, organizationId]);
				// FOR UPDATE: wait for the transaction holding the approval's row.
				await this.approvalHeld;
			},
			writeAtVersion: async (criteria: Row, columns) => {
				this.statements.push(['writeAtVersion', copy(criteria), copy(columns)]);
				if (criteria.id !== this.sharing.id || criteria.version !== this.sharing.version) {
					return 0;
				}
				pending.push(() => (this.sharing = { ...this.sharing, ...columns, version: this.sharing.version + 1 }));
				return 1;
			},
			replaceMembers: async (id, tenantId, members) => {
				this.statements.push(['replaceMembers', id, tenantId, copy(members)]);
				if (this.failMembers) {
					throw new Error('connection lost');
				}
				pending.push(() => {
					if (members.employees) {
						this.sharing.employees = [...members.employees];
					}
					if (members.teams) {
						this.sharing.teams = [...members.teams];
					}
				});
			},
			writeApproval: async (sharingId, tenantId, organizationId, patch) => {
				this.statements.push(['writeApproval', sharingId, tenantId, organizationId, copy(patch)]);
			}
		};

		// The commit: every write at once; a body that throws commits nothing.
		const result = await work(transaction);
		pending.forEach((apply) => apply());
		return result;
	}

	/** The names of the statements, in order. */
	get names(): string[] {
		return this.statements.map(([statement]) => statement);
	}
}

/** The service over the store: its reads see what the store has committed. */
function system(store: Store) {
	const typeOrmRepository = {
		metadata: { tableName: 'equipment_sharing' },
		// The stored-row read of the upsert check, and the diagnostic read of a conflict.
		findOne: jest.fn(async ({ where }: { where: Row }) => {
			if (where.id !== store.sharing.id || where.tenantId !== store.sharing.tenantId) {
				return null;
			}
			const { employees: _employees, teams: _teams, ...columns } = copy(store.sharing);
			return columns;
		})
	};
	const service = new EquipmentSharingService(
		typeOrmRepository as any,
		{} as any,
		{} as any,
		{ dbConnectionOptions: { type: 'postgres' } } as any
	);
	const read = jest.spyOn(service, 'findOneByIdString').mockImplementation(async () => copy(store.sharing) as any);
	jest.spyOn(service, 'assertReferencesAreInScope').mockResolvedValue(undefined);
	// The refusals the CRUD base's `create()` makes before it writes (their own specs cover them).
	const checks = {
		foreignRow: jest.spyOn(service as any, 'assertNotForeignRow').mockResolvedValue(undefined),
		foreignGraph: jest.spyOn(service as any, 'assertNestedGraphNotForeign').mockResolvedValue(undefined),
		boundary: jest.spyOn(service as any, 'assertInsideOrganizationBoundary').mockResolvedValue(undefined)
	};
	// The unlocked claim of the other upserts: `UPDATE … SET version = :next WHERE id = :id AND version = :read`.
	const claim = jest
		.spyOn(TenantAwareCrudService.prototype, 'update')
		.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] } as any);
	jest.spyOn(service as any, 'inPlaceTransaction').mockImplementation((work: any) => store.transaction(work));
	// The CRUD base's upsert the controller hands in.
	const create = jest.fn(async (payload: Row) => ({ ...payload }));

	const post = (body: Row) =>
		service.storeCreate(body as any, create as any).then(
			(value) => ({ value, error: undefined as any }),
			(error) => ({ value: undefined, error })
		);
	return { service, post, create, claim, read, checks };
}

describe('POST /equipment-sharing — an upsert that changes a stored sharing’s memberships takes the approval’s lock', () => {
	beforeEach(() => asUser());
	afterEach(() => jest.restoreAllMocks());

	it('locks the approval first, writes the columns at the version, then replaces the memberships, in one transaction', async () => {
		const store = new Store();
		const { post, create, claim, read } = system(store);

		const { error, value } = await post({
			id: ID,
			version: 1,
			name: 'Studio projector',
			employees: [{ id: EMPLOYEE_2 }]
		});

		expect(error).toBeUndefined();
		expect(store.statements).toEqual([
			['lockApprovals', ID, TENANT, ORG],
			[
				'writeAtVersion',
				{ id: ID, version: 1, tenantId: TENANT },
				// The payload's columns as the check pinned them; the organization stays (it does not move).
				{ name: 'Studio projector', equipmentId: EQUIPMENT, equipmentSharingPolicyId: null }
			],
			['replaceMembers', ID, TENANT, { employees: [EMPLOYEE_2] }]
		]);
		expect(store.sharing).toEqual(
			expect.objectContaining({
				name: 'Studio projector',
				version: 2,
				employees: [EMPLOYEE_2],
				teams: ['team-1']
			})
		);
		// Neither the CRUD base's unlocked upsert, nor its separate claim of the version.
		expect(create).not.toHaveBeenCalled();
		expect(claim).not.toHaveBeenCalled();
		// The answer is the sharing as written, with its memberships.
		expect(read).toHaveBeenLastCalledWith(ID, { relations: { employees: true, teams: true } });
		expect(value).toEqual(expect.objectContaining({ id: ID, employees: [EMPLOYEE_2] }));
	});

	it('waits for a decision that holds the approval’s lock before it writes anything', async () => {
		const store = new Store();
		const decision = deferred();
		store.approvalHeld = decision.promise;
		const { post } = system(store);

		const pending = post({ id: ID, version: 1, teams: [] });
		await settle();

		// The decision still holds the approval: the upsert has written nothing, and the memberships the decision's
		// requester check reads are the stored ones.
		expect(store.names).toEqual(['lockApprovals']);
		expect(store.sharing.teams).toEqual(['team-1']);

		decision.resolve();
		const { error } = await pending;

		expect(error).toBeUndefined();
		expect(store.names).toEqual(['lockApprovals', 'writeAtVersion', 'replaceMembers']);
		expect(store.sharing.teams).toEqual([]);
	});

	it('uses the version the check read when the body states none, and clears a membership stated as null', async () => {
		const store = new Store();
		store.sharing.version = 4;
		const { post } = system(store);

		const { error } = await post({ id: ID, teams: null });

		expect(error).toBeUndefined();
		expect(store.statements[1][1]).toEqual({ id: ID, version: 4, tenantId: TENANT });
		expect(store.statements[2]).toEqual(['replaceMembers', ID, TENANT, { teams: [] }]);
		expect(store.sharing.teams).toEqual([]);
	});

	it('is refused with 409 ENTITY_VERSION_CONFLICT when the row moved on, and writes nothing', async () => {
		const store = new Store();
		store.sharing.version = 3;
		const { post, create } = system(store);

		const { error } = await post({ id: ID, version: 2, employees: [EMPLOYEE_2] });

		expect(error).toBeInstanceOf(ApiException);
		expect(error.getStatus()).toBe(409);
		expect(error.code).toBe('ENTITY_VERSION_CONFLICT');
		expect(store.names).toEqual(['lockApprovals', 'writeAtVersion']);
		expect(store.sharing).toEqual(expect.objectContaining({ version: 3, employees: [EMPLOYEE_1] }));
		expect(create).not.toHaveBeenCalled();
	});

	it('rolls everything back, and answers 400, when the memberships cannot be written', async () => {
		const store = new Store();
		store.failMembers = true;
		const { post } = system(store);

		const { error } = await post({ id: ID, version: 1, name: 'Studio projector', employees: [EMPLOYEE_2] });

		expect(error.getStatus()).toBe(400);
		expect(store.sharing).toEqual(
			expect.objectContaining({ name: 'Projector', version: 1, employees: [EMPLOYEE_1] })
		);
	});

	it('makes the refusals of the CRUD base’s create() first, and locks nothing when one refuses', async () => {
		const store = new Store();
		const { post, checks } = system(store);
		checks.boundary.mockRejectedValueOnce(new ForbiddenException('The organization is outside the caller’s reach'));

		const { error } = await post({ id: ID, version: 1, employees: [EMPLOYEE_2] });

		expect(error).toBeInstanceOf(ForbiddenException);
		expect(checks.foreignRow).toHaveBeenCalledWith(expect.objectContaining({ id: ID }), TENANT);
		expect(checks.foreignGraph).toHaveBeenCalledWith([expect.objectContaining({ id: ID })], TENANT);
		expect(store.statements).toEqual([]);
	});

	it('refuses a membership list with an entry that names no id (400), before it locks anything', async () => {
		const store = new Store();
		const { post } = system(store);

		const { error } = await post({ id: ID, version: 1, employees: [{ id: EMPLOYEE_2 }, {}] });

		expect(error).toBeInstanceOf(ApiException);
		expect(error.getStatus()).toBe(400);
		expect(store.statements).toEqual([]);
		expect(store.sharing.employees).toEqual([EMPLOYEE_1]);
	});

	it('moves the sharing to the organization the payload was checked in, locking the approval where it is', async () => {
		const store = new Store();
		const { post } = system(store);

		const { error } = await post({ id: ID, version: 1, organizationId: OTHER_ORG, employees: [EMPLOYEE_2] });

		expect(error).toBeUndefined();
		expect(store.statements[0]).toEqual(['lockApprovals', ID, TENANT, ORG]);
		expect(store.statements[1][2]).toEqual(expect.objectContaining({ organizationId: OTHER_ORG }));
	});
});

describe('POST /equipment-sharing — the other upserts are stored as before', () => {
	beforeEach(() => asUser());
	afterEach(() => jest.restoreAllMocks());

	it('claims the version and upserts through create() when the body states no membership', async () => {
		const store = new Store();
		const { post, create, claim } = system(store);

		await post({ id: ID, version: 1, name: 'Studio projector' });

		expect(store.statements).toEqual([]);
		expect(claim).toHaveBeenCalledWith({ id: ID, version: 1 }, { version: 2 });
		expect(create).toHaveBeenCalledTimes(1);
	});

	it('creates a new sharing with its memberships through create(): it has no approval to lock yet', async () => {
		const store = new Store();
		const { post, create } = system(store);

		await post({ name: 'New', status: REQUESTED, employees: [EMPLOYEE_2] });

		expect(store.statements).toEqual([]);
		expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: 'New', employees: [EMPLOYEE_2] }));
	});

	it('upserts a retired sharing through create(), as before', async () => {
		const store = new Store();
		store.sharing.deletedAt = '2026-10-01T00:00:00.000Z';
		const { post, create } = system(store);

		await post({ id: ID, version: 1, employees: [EMPLOYEE_2] });

		expect(store.statements).toEqual([]);
		expect(create).toHaveBeenCalledTimes(1);
	});
});

describe('the locked upsert on TypeORM', () => {
	const APPROVAL_OF_THE_SHARING = {
		requestId: ID,
		requestType: ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING,
		tenantId: TENANT,
		organizationId: ORG
	};

	beforeEach(() => asUser());
	afterEach(() => {
		jest.restoreAllMocks();
		(isPostgres as jest.Mock).mockReturnValue(false);
		(isMySQL as jest.Mock).mockReturnValue(false);
	});

	function typeOrm() {
		const relation = {
			of: jest.fn().mockReturnThis(),
			loadMany: jest.fn(async () => [{ id: EMPLOYEE_1 }]),
			add: jest.fn(async () => undefined),
			remove: jest.fn(async () => undefined)
		};
		const builder = {
			where: jest.fn().mockReturnThis(),
			setLock: jest.fn().mockReturnThis(),
			getMany: jest.fn(async () => [{ id: 'approval-1' }]),
			relation: jest.fn(() => relation)
		};
		const manager = {
			createQueryBuilder: jest.fn((..._args: unknown[]) => builder),
			update: jest.fn(async (..._args: unknown[]) => ({ affected: 1 }))
		};
		const stored = {
			id: ID,
			organizationId: ORG,
			equipmentId: EQUIPMENT,
			equipmentSharingPolicyId: null,
			version: 2
		};
		const typeOrmRepository = {
			metadata: { tableName: 'equipment_sharing' },
			findOne: jest.fn(async () => ({ ...stored, deletedAt: null })),
			manager: { transaction: jest.fn(async (work: any) => await work(manager)) }
		};
		const service = new EquipmentSharingService(
			typeOrmRepository as any,
			{} as any,
			{} as any,
			{ dbConnectionOptions: { type: 'postgres' } } as any
		);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(service, 'findOneByIdString').mockResolvedValue({ ...stored, tenantId: TENANT } as any);
		jest.spyOn(service, 'assertReferencesAreInScope').mockResolvedValue(undefined);
		jest.spyOn(service as any, 'assertNotForeignRow').mockResolvedValue(undefined);
		jest.spyOn(service as any, 'assertNestedGraphNotForeign').mockResolvedValue(undefined);
		jest.spyOn(service as any, 'assertInsideOrganizationBoundary').mockResolvedValue(undefined);
		return { service, manager, builder, relation, typeOrmRepository };
	}

	it.each([
		['PostgreSQL', isPostgres],
		['MySQL', isMySQL]
	])('on %s locks the approval FOR UPDATE first, then writes the sharing and its pivot', async (_, dialect) => {
		(dialect as jest.Mock).mockReturnValue(true);
		const { service, manager, builder, relation, typeOrmRepository } = typeOrm();
		const create = jest.fn();

		await service.storeCreate({ id: ID, version: 2, employees: [{ id: EMPLOYEE_2 }] } as any, create);

		expect(create).not.toHaveBeenCalled();
		expect(typeOrmRepository.manager.transaction).toHaveBeenCalledTimes(1);
		// The approval's lock, the first statement.
		expect(manager.createQueryBuilder.mock.calls[0]).toEqual([RequestApproval, 'request_approval']);
		expect(builder.where).toHaveBeenCalledWith(APPROVAL_OF_THE_SHARING);
		expect(builder.setLock).toHaveBeenCalledWith('pessimistic_write');
		expect(builder.getMany.mock.invocationCallOrder[0]).toBeLessThan(manager.update.mock.invocationCallOrder[0]);
		// Then the sharing's compare-and-set, which holds its row, then the pivot rows.
		expect(manager.update.mock.calls).toEqual([
			[
				EquipmentSharing,
				{ id: ID, version: 2, tenantId: TENANT },
				{ equipmentId: EQUIPMENT, equipmentSharingPolicyId: null }
			]
		]);
		expect(manager.update.mock.invocationCallOrder[0]).toBeLessThan(relation.loadMany.mock.invocationCallOrder[0]);
		expect(builder.relation).toHaveBeenCalledWith(EquipmentSharing, 'employees');
		expect(relation.remove).toHaveBeenCalledWith([EMPLOYEE_1]);
		expect(relation.add).toHaveBeenCalledWith([EMPLOYEE_2]);
	});
});
