// Must stay first: loads the entity graph before the service pulls an entity.
import '../core/entities/internal';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LockMode } from '@mikro-orm/core';
import { isMySQL, isPostgres } from '@gauzy/config';
import { ApprovalPolicyTypesStringEnum, RequestApprovalStatusTypesEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { Employee, OrganizationTeam, RequestApproval } from '../core/entities/internal';
import { ApiException } from '../core/errors/api-exception';
import { MultiORMEnum } from '../core/utils';
import { EquipmentSharingUpdateInPlaceCommand } from './commands/equipment-sharing.update-in-place.command';
import { EquipmentSharingUpdateInPlaceHandler } from './commands/handlers/equipment-sharing.update-in-place.handler';
import { EquipmentSharing } from './equipment-sharing.entity';
import { EquipmentSharingService, IEquipmentSharingInPlaceTransaction } from './equipment-sharing.service';
import { inPlaceSharingChange } from './in-place-update.helper';

/**
 * Owner decision Q17 (2026-10-24): an in-place, version-checked edit of an equipment sharing, beside the edit that
 * removes the row and files it again (`PUT /equipment-sharing/:id`, kept as it is).
 *
 * That edit leaves a moment where the row is missing — a `POST /equipment-sharing` naming its id then inserts it, and
 * the recreate overwrites it (ever-co/ever-gauzy#11398). `PUT /equipment-sharing/:id/in-place` (GraphQL
 * `updateEquipmentSharingInPlace`) writes the row where it is, in one statement predicated on the version the body
 * states, and is refused with 409 `ENTITY_VERSION_CONFLICT` when the row has moved on.
 *
 * The edit locks the sharing's request approval before it writes anything: the order the decision
 * (`decideWithRequestApproval`) and the request approval's answer take their locks in, approval then sharing, so an
 * edit and a decision cannot each hold one row while waiting for the other; and an answer's requester check and an
 * edit of the memberships take turns.
 *
 * The store below commits a transaction's writes when its body returns and drops them when it throws; the last
 * blocks pin the statements each ORM arm sends.
 */

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: jest.fn(() => false),
	isMySQL: jest.fn(() => false)
}));

const { REQUESTED, APPROVED } = RequestApprovalStatusTypesEnum;

const TENANT = 'tenant-a';
const ORG = 'org-a';
const OTHER_ORG = 'org-b';
const ID = 'sharing-1';
const EQUIPMENT = 'equipment-1';
const POLICY = 'policy-1';
const EMPLOYEE_1 = 'employee-1';
const EMPLOYEE_2 = 'employee-2';
const EMPLOYEE_3 = 'employee-3';

type Row = Record<string, any>;

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Lets every pending promise callback run, so a blocked edit has gone as far as it can. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

function deferred() {
	let resolve: () => void = () => undefined;
	const promise = new Promise<void>((done) => (resolve = done));
	return { promise, resolve };
}

function asUser(role: RolesEnum = RolesEnum.MANAGER) {
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
		id: 'user-1',
		tenantId: TENANT,
		lastOrganizationId: ORG,
		role: { name: role },
		permissions: []
	} as any);
}

/** The approval criteria every statement on the sharing's request approval names. */
const APPROVAL_OF_THE_SHARING = {
	requestId: ID,
	requestType: ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING,
	tenantId: TENANT,
	organizationId: ORG
};

/** One sharing with its memberships, its request approval, and the in-place edit's transaction over them. */
class Store {
	sharing: Row = {
		id: ID,
		tenantId: TENANT,
		organizationId: ORG,
		name: 'Projector',
		status: REQUESTED,
		equipmentId: EQUIPMENT,
		version: 1,
		employees: [EMPLOYEE_1],
		teams: ['team-1']
	};
	approval: Row = {
		id: 'approval-1',
		requestId: ID,
		requestType: ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING,
		tenantId: TENANT,
		organizationId: ORG,
		name: 'Projector',
		status: REQUESTED
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
				// An UPDATE's compare-and-set reads what is committed.
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
				pending.push(() => (this.approval = { ...this.approval, ...patch }));
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

/** The in-place handler over a service whose reads see what the store has committed. */
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
	const read = jest.spyOn(service, 'findOneByIdString').mockImplementation(async () => copy(store.sharing) as any);
	const scope = jest.spyOn(service, 'assertReferencesAreInScope').mockResolvedValue(undefined);
	const remove = jest.spyOn(service, 'delete');
	const removeAtVersion = jest.spyOn(service, 'deleteAtVersion');
	jest.spyOn(service as any, 'inPlaceTransaction').mockImplementation((work: any) => store.transaction(work));

	const handler = new EquipmentSharingUpdateInPlaceHandler(service);
	const edit = (input: Row) =>
		handler.execute(new EquipmentSharingUpdateInPlaceCommand(ID, input as any)).then(
			(value) => ({ value, error: undefined as any }),
			(error) => ({ value: undefined, error })
		);
	return { edit, read, scope, remove, removeAtVersion };
}

describe('editing an equipment sharing in place, at the version the edit is based on', () => {
	beforeEach(() => asUser());
	afterEach(() => jest.restoreAllMocks());

	it('writes the stated columns where the row is, at the stated version, and moves the version on', async () => {
		const store = new Store();
		const { edit, remove, removeAtVersion } = system(store);

		const { error } = await edit({ version: 1, shareEndDay: '2026-11-01T10:00:00.000Z' });

		expect(error).toBeUndefined();
		expect(store.statements).toEqual([
			['lockApprovals', ID, TENANT, ORG],
			['writeAtVersion', { id: ID, version: 1, tenantId: TENANT }, { shareEndDay: '2026-11-01T10:00:00.000Z' }]
		]);
		expect(store.sharing).toEqual(
			expect.objectContaining({ name: 'Projector', version: 2, status: REQUESTED, equipmentId: EQUIPMENT })
		);
		// A member left out keeps its stored value, and the row is never removed.
		expect(store.sharing.employees).toEqual([EMPLOYEE_1]);
		expect(remove).not.toHaveBeenCalled();
		expect(removeAtVersion).not.toHaveBeenCalled();
	});

	it('is refused with 409 ENTITY_VERSION_CONFLICT when the row moved on, and writes nothing', async () => {
		const store = new Store();
		store.sharing.version = 3;
		const { edit } = system(store);

		const { error } = await edit({ version: 2, name: 'Studio projector', employees: [{ id: EMPLOYEE_2 }] });

		expect(error).toBeInstanceOf(ApiException);
		expect(error.getStatus()).toBe(409);
		expect(error.code).toBe('ENTITY_VERSION_CONFLICT');
		expect(error.details).toEqual({ id: ID, expectedVersion: 2, actualVersion: 3 });
		// Nothing after the compare-and-set ran, and nothing was written.
		expect(store.names).toEqual(['lockApprovals', 'writeAtVersion']);
		expect(store.sharing).toEqual(expect.objectContaining({ name: 'Projector', version: 3, employees: [EMPLOYEE_1] }));
		expect(store.approval.name).toBe('Projector');
	});

	it('of two edits based on the same version, writes the first and refuses the second', async () => {
		const store = new Store();
		const { edit } = system(store);

		const first = await edit({ version: 1, name: 'First' });
		const second = await edit({ version: 1, name: 'Second' });

		expect(first.error).toBeUndefined();
		expect(second.error).toBeInstanceOf(ApiException);
		expect(second.error.getStatus()).toBe(409);
		expect(store.sharing).toEqual(expect.objectContaining({ name: 'First', version: 2 }));
		expect(store.approval.name).toBe('First');
	});

	it.each([
		['no version', {}],
		['a null version', { version: null }],
		['a version that is not one', { version: 'latest' }],
		['a zero version', { version: 0 }]
	])('requires the version: %s is refused with 400, before anything is read or written', async (_, version) => {
		const store = new Store();
		const { edit, read } = system(store);

		const { error } = await edit({ ...version, name: 'Studio projector' });

		expect(error).toBeInstanceOf(ApiException);
		expect(error.getStatus()).toBe(400);
		expect(error.details).toEqual({ field: 'version' });
		expect(read).not.toHaveBeenCalled();
		expect(store.statements).toEqual([]);
	});

	it.each([null, 7, '2'])('refuses a status that is not one of the vocabulary (%p) with 400', async (status) => {
		const store = new Store();
		const { edit } = system(store);

		const { error } = await edit({ version: 1, status });

		expect(error).toBeInstanceOf(ApiException);
		expect(error.getStatus()).toBe(400);
		expect(error.details).toEqual({ field: 'status' });
		expect(store.statements).toEqual([]);
	});

	it('writes none of the members that are not its columns: id, tenant, organization, audit, the version itself', async () => {
		const store = new Store();
		const { edit } = system(store);

		await edit({
			version: 1,
			id: 'sharing-other',
			tenantId: 'tenant-other',
			organizationId: OTHER_ORG,
			organization: { id: OTHER_ORG },
			createdByUserId: 'user-other',
			shareStartDay: '2026-11-01T10:00:00.000Z'
		});

		expect(store.statements[1]).toEqual([
			'writeAtVersion',
			{ id: ID, version: 1, tenantId: TENANT },
			{ shareStartDay: '2026-11-01T10:00:00.000Z' }
		]);
		expect(store.sharing.organizationId).toBe(ORG);
	});

	it('replaces the memberships the body states, and leaves the ones it does not state', async () => {
		const store = new Store();
		const { edit } = system(store);

		await edit({ version: 1, employees: [{ id: EMPLOYEE_2 }, EMPLOYEE_3] });

		expect(store.statements[2]).toEqual(['replaceMembers', ID, TENANT, { employees: [EMPLOYEE_2, EMPLOYEE_3] }]);
		expect(store.sharing.employees).toEqual([EMPLOYEE_2, EMPLOYEE_3]);
		expect(store.sharing.teams).toEqual(['team-1']);
		// An edit of the memberships alone still moves the version on.
		expect(store.sharing.version).toBe(2);
	});

	it('clears a membership the body states as an empty list', async () => {
		const store = new Store();
		const { edit } = system(store);

		await edit({ version: 1, teams: [] });

		expect(store.statements[2]).toEqual(['replaceMembers', ID, TENANT, { teams: [] }]);
		expect(store.sharing.teams).toEqual([]);
	});

	it.each([
		['an entry naming no id', { employees: [{}] }, 'employees'],
		['an entry with an empty id', { teams: [{ id: '' }] }, 'teams'],
		['one bad entry among good ones', { employees: [EMPLOYEE_2, { name: 'Bob' }] }, 'employees'],
		['a value that is not a list', { employees: EMPLOYEE_2 }, 'employees']
	])('refuses a membership list with %s (400), rather than replacing the membership with less', async (_, body, field) => {
		const store = new Store();
		const { edit } = system(store);

		const { error } = await edit({ version: 1, ...body });

		expect(error).toBeInstanceOf(ApiException);
		expect(error.getStatus()).toBe(400);
		expect(error.details).toEqual({ field });
		expect(store.statements).toEqual([]);
		expect(store.sharing.employees).toEqual([EMPLOYEE_1]);
		expect(store.sharing.teams).toEqual(['team-1']);
	});

	it('moves the request approval with the status in the same commit, and leaves it alone when the status stays', async () => {
		const changed = new Store();
		await system(changed).edit({ version: 1, status: APPROVED });

		expect(changed.statements[2]).toEqual(['writeApproval', ID, TENANT, ORG, { status: APPROVED }]);
		expect(changed.sharing.status).toBe(APPROVED);
		expect(changed.approval).toEqual(expect.objectContaining({ id: 'approval-1', status: APPROVED }));

		const unchanged = new Store();
		await system(unchanged).edit({ version: 1, status: REQUESTED, name: 'Projector' });

		expect(unchanged.names).toEqual(['lockApprovals', 'writeAtVersion']);
		expect(unchanged.approval.status).toBe(REQUESTED);
	});

	it('renames the request approval with the sharing, in the same commit, keeping its id', async () => {
		const store = new Store();
		const { edit } = system(store);

		await edit({ version: 1, name: 'Studio projector', status: APPROVED });

		expect(store.statements[2]).toEqual([
			'writeApproval',
			ID,
			TENANT,
			ORG,
			{ status: APPROVED, name: 'Studio projector' }
		]);
		expect(store.approval).toEqual(
			expect.objectContaining({ id: 'approval-1', name: 'Studio projector', status: APPROVED })
		);
	});

	it.each([
		['cleared', null],
		['emptied', ''],
		['blank', '   ']
	])('leaves the approval’s name when the sharing’s is %s: the approval’s name is required', async (_, name) => {
		const store = new Store();
		const { edit } = system(store);

		await edit({ version: 1, name });

		expect(store.names).toEqual(['lockApprovals', 'writeAtVersion']);
		expect(store.approval.name).toBe('Projector');
	});

	it('takes the approval’s lock before it writes the sharing, and waits for a decision holding it', async () => {
		const store = new Store();
		const { edit } = system(store);
		const decision = deferred();
		store.approvalHeld = decision.promise;

		const editing = edit({ version: 1, employees: [EMPLOYEE_2], status: APPROVED });
		await settle();

		// Blocked on the approval's row: the sharing's row is not taken while the decision holds the approval's,
		// so the two cannot wait for each other.
		expect(store.names).toEqual(['lockApprovals']);

		decision.resolve();
		const { error } = await editing;

		expect(error).toBeUndefined();
		expect(store.names).toEqual(['lockApprovals', 'writeAtVersion', 'replaceMembers', 'writeApproval']);
	});

	it('holds the equipment, the policy and the members it names to the row’s own organization', async () => {
		const store = new Store();
		const { edit, scope } = system(store);

		await edit({
			version: 1,
			equipment: { id: 'equipment-2' },
			equipmentSharingPolicyId: POLICY,
			employees: [{ id: EMPLOYEE_2 }]
		});

		expect(scope).toHaveBeenCalledWith(
			{
				equipmentId: 'equipment-2',
				equipmentSharingPolicyId: POLICY,
				employees: [EMPLOYEE_2],
				teams: undefined
			},
			{ tenantId: TENANT, organizationId: ORG }
		);
		expect(store.statements[1]).toEqual([
			'writeAtVersion',
			{ id: ID, version: 1, tenantId: TENANT },
			{ equipmentId: 'equipment-2', equipmentSharingPolicyId: POLICY }
		]);
	});

	it('writes nothing when a reference is outside the organization', async () => {
		const store = new Store();
		const { edit, scope } = system(store);
		scope.mockRejectedValueOnce(new ForbiddenException('out of scope'));

		const { error } = await edit({ version: 1, equipmentId: 'equipment-foreign' });

		expect(error).toBeInstanceOf(ForbiddenException);
		expect(store.statements).toEqual([]);
	});

	it('rolls everything back on a failure inside the transaction, answered 400', async () => {
		const store = new Store();
		store.failMembers = true;
		const { edit } = system(store);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);

		const { error } = await edit({ version: 1, name: 'Studio projector', employees: [EMPLOYEE_2] });

		expect(error).toBeInstanceOf(BadRequestException);
		expect(store.sharing).toEqual(expect.objectContaining({ name: 'Projector', version: 1, employees: [EMPLOYEE_1] }));
		expect(store.approval.name).toBe('Projector');
	});
});

describe('inPlaceSharingChange', () => {
	it('reads the related objects as their columns, the related object winning', () => {
		expect(
			inPlaceSharingChange({
				equipment: { id: 'equipment-2' },
				equipmentId: EQUIPMENT,
				equipmentSharingPolicy: null,
				name: 'Projector'
			} as any)
		).toEqual({
			columns: { name: 'Projector', equipmentId: 'equipment-2', equipmentSharingPolicyId: null },
			members: {}
		});
	});

	it('states a membership only when the body states it, each id once', () => {
		expect(inPlaceSharingChange({ employees: [{ id: EMPLOYEE_1 }, EMPLOYEE_1, EMPLOYEE_2] } as any).members).toEqual({
			employees: [EMPLOYEE_1, EMPLOYEE_2]
		});
		expect(inPlaceSharingChange({ teams: null } as any).members).toEqual({ teams: [] });
		expect(inPlaceSharingChange({} as any).members).toEqual({});
	});
});

describe('the in-place edit on each ORM', () => {
	const sharing = () => ({
		id: ID,
		tenantId: TENANT,
		organizationId: ORG,
		name: 'Projector',
		status: REQUESTED,
		version: 2
	});

	beforeEach(() => asUser());
	afterEach(() => {
		jest.restoreAllMocks();
		(isPostgres as jest.Mock).mockReturnValue(false);
		(isMySQL as jest.Mock).mockReturnValue(false);
	});

	describe('TypeORM', () => {
		function typeOrm(affected = 1) {
			const relation = {
				of: jest.fn().mockReturnThis(),
				loadMany: jest.fn(async () => [{ id: EMPLOYEE_1 }, { id: EMPLOYEE_2 }]),
				add: jest.fn(async () => undefined),
				remove: jest.fn(async () => undefined)
			};
			const builder = {
				where: jest.fn().mockReturnThis(),
				setLock: jest.fn().mockReturnThis(),
				getMany: jest.fn(async () => []),
				relation: jest.fn(() => relation)
			};
			const manager = {
				createQueryBuilder: jest.fn((..._args: unknown[]) => builder),
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
			jest.spyOn(service, 'assertReferencesAreInScope').mockResolvedValue(undefined);
			return { service, manager, builder, relation, typeOrmRepository };
		}

		it.each([
			['PostgreSQL', isPostgres],
			['MySQL', isMySQL]
		])(
			'on %s locks the approval FOR UPDATE first, then writes the row, the memberships and the approval',
			async (_, dialect) => {
				(dialect as jest.Mock).mockReturnValue(true);
				const { service, manager, builder, relation, typeOrmRepository } = typeOrm();

				await service.updateInPlace(ID, {
					version: 2,
					name: 'Studio projector',
					status: APPROVED,
					employees: [{ id: EMPLOYEE_2 }, { id: EMPLOYEE_3 }]
				} as any);

				expect(typeOrmRepository.manager.transaction).toHaveBeenCalledTimes(1);
				// The approval's lock, the first statement.
				expect(manager.createQueryBuilder.mock.calls[0]).toEqual([RequestApproval, 'request_approval']);
				expect(builder.where).toHaveBeenCalledWith(APPROVAL_OF_THE_SHARING);
				expect(builder.setLock).toHaveBeenCalledWith('pessimistic_write');
				expect(builder.getMany.mock.invocationCallOrder[0]).toBeLessThan(
					manager.update.mock.invocationCallOrder[0]
				);
				expect(manager.update.mock.calls).toEqual([
					[
						EquipmentSharing,
						{ id: ID, version: 2, tenantId: TENANT },
						{ name: 'Studio projector', status: APPROVED }
					],
					[RequestApproval, APPROVAL_OF_THE_SHARING, { status: APPROVED, name: 'Studio projector' }]
				]);
				// The memberships through the relation's own pivot, only the difference.
				expect(builder.relation).toHaveBeenCalledWith(EquipmentSharing, 'employees');
				expect(builder.relation).not.toHaveBeenCalledWith(EquipmentSharing, 'teams');
				expect(relation.of).toHaveBeenCalledWith(ID);
				expect(relation.remove).toHaveBeenCalledWith([EMPLOYEE_1]);
				expect(relation.add).toHaveBeenCalledWith([EMPLOYEE_3]);
			}
		);

		it('on SQLite reads the approval without a lock: the transaction is serialized there', async () => {
			const { service, builder } = typeOrm();

			await service.updateInPlace(ID, { version: 2, employees: [EMPLOYEE_2] } as any);

			expect(builder.where).toHaveBeenCalledWith(APPROVAL_OF_THE_SHARING);
			expect(builder.setLock).not.toHaveBeenCalled();
			expect(builder.getMany).toHaveBeenCalledTimes(1);
		});

		it('answers 409 with both versions when the compare-and-set matched nothing, and writes nothing else', async () => {
			const { service, manager, builder } = typeOrm(0);

			const error = await service
				.updateInPlace(ID, { version: 2, status: APPROVED, employees: [EMPLOYEE_3] } as any)
				.catch((reason) => reason);

			expect(error).toBeInstanceOf(ApiException);
			expect(error.getStatus()).toBe(409);
			expect(error.details).toEqual({ id: ID, expectedVersion: 2, actualVersion: 3 });
			expect(manager.update.mock.calls.map(([entity]) => entity)).toEqual([EquipmentSharing]);
			expect(builder.relation).not.toHaveBeenCalled();
		});
	});

	describe('MikroORM', () => {
		function mikroOrm() {
			const loaded = { employees: { set: jest.fn() }, teams: { set: jest.fn() } };
			const em = {
				find: jest.fn(async (..._args: unknown[]) => []),
				findOne: jest.fn(async (..._args: unknown[]) => loaded),
				getReference: jest.fn((entity: unknown, id: string) => ({ entity, id })),
				flush: jest.fn(async () => undefined),
				nativeUpdate: jest.fn(async (..._args: unknown[]) => 1),
				getMetadata: () => ({ find: () => undefined })
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
			jest.spyOn(service, 'assertReferencesAreInScope').mockResolvedValue(undefined);
			// The sharing's row as `CrudService.update` writes it on MikroORM (its own spec pins the details).
			jest.spyOn(service as any, 'mikroOrmUpdateRow').mockImplementation((row: any) => ({
				...row,
				version: 'version + 1'
			}));
			return { service, em, loaded, transactional };
		}

		it('on PostgreSQL locks the approval first, writes the row in the statement, the memberships and the approval', async () => {
			(isPostgres as jest.Mock).mockReturnValue(true);
			const { service, em, loaded, transactional } = mikroOrm();

			await service.updateInPlace(ID, {
				version: 2,
				name: 'Studio projector',
				status: APPROVED,
				teams: [{ id: 'team-2' }]
			} as any);

			expect(transactional).toHaveBeenCalledTimes(1);
			expect(em.find).toHaveBeenCalledWith(RequestApproval, APPROVAL_OF_THE_SHARING, {
				disableIdentityMap: true,
				lockMode: LockMode.PESSIMISTIC_WRITE
			});
			expect(em.find.mock.invocationCallOrder[0]).toBeLessThan(em.nativeUpdate.mock.invocationCallOrder[0]);
			expect(em.nativeUpdate.mock.calls).toEqual([
				[
					EquipmentSharing,
					{ id: ID, version: 2, tenantId: TENANT },
					{ name: 'Studio projector', status: APPROVED, version: 'version + 1' }
				],
				[RequestApproval, APPROVAL_OF_THE_SHARING, { status: APPROVED, name: 'Studio projector' }]
			]);
			// Read again from the table, so the flush sees the version the compare-and-set wrote.
			expect(em.findOne).toHaveBeenCalledWith(
				EquipmentSharing,
				{ id: ID, tenantId: TENANT },
				{ populate: ['employees', 'teams'], refresh: true }
			);
			expect(loaded.teams.set).toHaveBeenCalledWith([{ entity: OrganizationTeam, id: 'team-2' }]);
			expect(loaded.employees.set).not.toHaveBeenCalled();
			expect(em.getReference).not.toHaveBeenCalledWith(Employee, expect.anything());
			expect(em.flush).toHaveBeenCalledTimes(1);
		});

		it('on SQLite reads the approval without a lock mode, and touches no membership the body does not state', async () => {
			const { service, em } = mikroOrm();

			await service.updateInPlace(ID, { version: 2, shareEndDay: '2026-11-01T10:00:00.000Z' } as any);

			expect(em.find).toHaveBeenCalledWith(RequestApproval, APPROVAL_OF_THE_SHARING, { disableIdentityMap: true });
			expect(em.findOne).not.toHaveBeenCalled();
			expect(em.flush).not.toHaveBeenCalled();
			expect(em.nativeUpdate.mock.calls.map(([entity]) => entity)).toEqual([EquipmentSharing]);
		});
	});
});
