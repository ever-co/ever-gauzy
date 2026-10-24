// Must stay first: loads the entity graph before the service pulls an entity.
import '../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { getMetadataArgsStorage } from 'typeorm';
import { RequestApprovalStatusTypesEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { ApiException } from '../core/errors/api-exception';
import { EquipmentSharingUpdateCommand } from './commands/equipment-sharing.update.command';
import { EquipmentSharingUpdateHandler } from './commands/handlers/equipment-sharing.update.handler';
import { EquipmentSharing } from './equipment-sharing.entity';
import { EquipmentSharingService } from './equipment-sharing.service';

/**
 * The optimistic version of an equipment sharing (review on ever-co/ever-gauzy#11359).
 *
 * Two authorized editors who read the same sharing and both wrote it back interleaved column by column: the edit is
 * a delete-then-recreate whose recreate is the CRUD base's upsert, and `save()` writes only the columns that differ
 * from what it loads, so the second edit kept the first one's columns wherever it stated none. Every edit is now a
 * compare-and-set on the version it read — the body's `version`, else the server's read — and is refused with 409
 * `ENTITY_VERSION_CONFLICT` when the row has moved on.
 *
 * The service runs over a store double whose writes have the semantics of the statements the CRUD base sends: a
 * criterion naming `version` matches only that version, an update moves the version on (as TypeORM's
 * `@VersionColumn` and `CrudService.update` on MikroORM do), and the upsert merges the payload into the stored row.
 */

const TENANT = 'tenant-a';
const ORG = 'org-a';
const OTHER_ORG = 'org-b';
const ID = 'sharing-1';

type Row = Record<string, any>;

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function asUser(role: RolesEnum = RolesEnum.ADMIN, organizationId = ORG) {
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
		id: 'user-1',
		tenantId: TENANT,
		lastOrganizationId: organizationId,
		role: { name: role },
		permissions: []
	} as any);
}

/** The store double, holding one sharing, and the service over it. */
function setUp(initial: Row | null = { name: 'Laptop', status: 1, equipmentId: 'equipment-1', version: 1 }) {
	const store: { row: Row | null; statements: string[] } = {
		row: initial ? { id: ID, tenantId: TENANT, organizationId: ORG, ...initial } : null,
		statements: []
	};
	const matches = (criteria: Row) =>
		!!store.row &&
		criteria.id === store.row.id &&
		(!('version' in criteria) || criteria.version === store.row.version);

	const typeOrmRepository = {
		metadata: { tableName: 'equipment_sharing' },
		// The stored-row read of the upsert check, and the diagnostic read of a conflict.
		findOne: jest.fn(async ({ where }: { where: Row }) =>
			store.row && store.row.id === where.id && store.row.tenantId === where.tenantId ? copy(store.row) : null
		),
		manager: { findOne: jest.fn(async () => ({ id: 'in-scope' })) }
	};
	const requestApprovalRepository = { delete: jest.fn(async () => ({ affected: 1 })) };
	const service = new EquipmentSharingService(
		typeOrmRepository as any,
		{} as any,
		requestApprovalRepository as any,
		{ dbConnectionOptions: { type: 'postgres' } } as any
	);

	jest.spyOn(service, 'findOneByIdString').mockImplementation(async (id) => {
		if (!store.row || store.row.id !== id) {
			throw new NotFoundException('The requested record was not found');
		}
		return copy(store.row) as any;
	});
	// `DELETE … WHERE <criteria>`.
	jest.spyOn(TenantAwareCrudService.prototype, 'delete').mockImplementation(async (criteria: any) => {
		store.statements.push(`delete ${JSON.stringify(criteria)}`);
		if (!matches(criteria)) {
			return { affected: 0, raw: [] };
		}
		store.row = null;
		return { affected: 1, raw: [] };
	});
	// `UPDATE … SET <patch>, version = version + 1 (unless stated) WHERE <criteria>`.
	jest.spyOn(TenantAwareCrudService.prototype, 'update').mockImplementation(async (criteria: any, patch: any) => {
		store.statements.push(`update ${JSON.stringify(criteria)} ${JSON.stringify(patch)}`);
		if (!matches(criteria)) {
			return { affected: 0, raw: [], generatedMaps: [] };
		}
		store.row = { ...store.row, ...patch, version: patch.version ?? store.row.version + 1 };
		return { affected: 1, raw: [], generatedMaps: [] };
	});
	// The upsert: an insert when the id names no row, else the payload merged into it and the version moved on.
	const create = jest.spyOn(service, 'create').mockImplementation(async (payload: any) => {
		store.statements.push(`create ${JSON.stringify(payload)}`);
		store.row = store.row
			? { ...store.row, ...payload, version: payload.version ?? store.row.version + 1 }
			: { version: 1, ...payload };
		return copy(store.row) as any;
	});

	return { service, store, create, typeOrmRepository, requestApprovalRepository };
}

/** The update handler over the service, with a request approval service that records nothing. */
function editor(service: EquipmentSharingService) {
	const approvals = {
		delete: jest.fn(async () => ({ affected: 1 })),
		create: jest.fn(async (row: Row) => row)
	};
	const handler = new EquipmentSharingUpdateHandler(service, approvals as any);
	const edit = (input: Row) => handler.execute(new EquipmentSharingUpdateCommand(ID, input as any));
	return { edit, approvals };
}

/** A promise that resolves once `count` callers have reached it. */
function barrier(count: number) {
	let arrived = 0;
	let open: () => void = () => undefined;
	const opened = new Promise<void>((resolve) => (open = resolve));
	return async () => {
		arrived += 1;
		if (arrived >= count) {
			open();
		}
		await opened;
	};
}

const settled = <T>(promise: Promise<T>) =>
	promise.then(
		(value) => ({ value, error: undefined as unknown }),
		(error) => ({ value: undefined as T, error })
	);

describe('EquipmentSharing.version — the column', () => {
	it('is TypeORM’s @VersionColumn, which the CRUD base increments on every update and save', () => {
		const column = getMetadataArgsStorage().columns.find(
			(it) => it.target === EquipmentSharing && it.propertyName === 'version'
		);

		expect(column?.mode).toBe('version');
	});
});

describe('EquipmentSharingService — writes predicated on the version', () => {
	beforeEach(() => asUser());
	afterEach(() => jest.restoreAllMocks());

	it('removes a sharing only at the version given, with its approval row', async () => {
		const { service, store, requestApprovalRepository } = setUp();

		await service.deleteAtVersion(ID, 1);

		expect(store.row).toBeNull();
		expect(store.statements).toEqual([`delete ${JSON.stringify({ id: ID, version: 1 })}`]);
		expect(requestApprovalRepository.delete).toHaveBeenCalledWith({ requestId: ID, tenantId: TENANT });
	});

	it('refuses to remove a sharing that moved on: 409 with both versions, and the approval row stays', async () => {
		const { service, store, requestApprovalRepository } = setUp({ name: 'Laptop', status: 1, version: 3 });

		const error = await service.deleteAtVersion(ID, 2).catch((reason) => reason);

		expect(error).toBeInstanceOf(ApiException);
		expect(error.getStatus()).toBe(409);
		expect(error.code).toBe('ENTITY_VERSION_CONFLICT');
		expect(error.details).toEqual({ id: ID, expectedVersion: 2, actualVersion: 3 });
		expect(store.row).not.toBeNull();
		expect(requestApprovalRepository.delete).not.toHaveBeenCalled();
	});

	it('writes columns only at the version given, and moves it on', async () => {
		const { service, store } = setUp();

		await service.updateAtVersion(ID, 1, { name: 'Projector' });

		expect(store.row).toMatchObject({ name: 'Projector', version: 2 });
		await expect(service.updateAtVersion(ID, 1, { name: 'Stale' })).rejects.toBeInstanceOf(ApiException);
		expect(store.row.name).toBe('Projector');
	});
});

describe('PUT /equipment-sharing/:id — two editors at the same time', () => {
	beforeEach(() => asUser());
	afterEach(() => jest.restoreAllMocks());

	it('CONTROL: the edit as it was — remove, then upsert — keeps columns of both edits', async () => {
		const { service, store } = setUp({ name: 'Laptop', status: 1, equipmentId: 'equipment-1', version: 1 });

		// Both removals run before either recreate: the second removes nothing, and its upsert merges into the
		// first one's row, keeping the first edit's equipment beside the second edit's name.
		await TenantAwareCrudService.prototype.delete.call(service, { id: ID });
		await TenantAwareCrudService.prototype.delete.call(service, { id: ID });
		await service.create({ id: ID, tenantId: TENANT, organizationId: ORG, status: 1, equipmentId: 'equipment-2' });
		await service.create({ id: ID, tenantId: TENANT, organizationId: ORG, status: 1, name: 'Projector' });

		expect(store.row).toMatchObject({ name: 'Projector', equipmentId: 'equipment-2' });
	});

	it('lets one of two edits based on the same read through, and refuses the other with 409 before it writes', async () => {
		const { service, store, create } = setUp({ name: 'Laptop', status: 1, equipmentId: 'equipment-1', version: 1 });
		const { edit, approvals } = editor(service);
		// Both edits read the row before either writes.
		const bothRead = barrier(2);
		const read = (service.findOneByIdString as jest.Mock).getMockImplementation();
		(service.findOneByIdString as jest.Mock).mockImplementation(async (id: string) => {
			const row = await read(id);
			await bothRead();
			return row;
		});

		const [first, second] = await Promise.all([
			settled(edit({ status: 1, equipmentId: 'equipment-2' })),
			settled(edit({ status: 1, name: 'Projector' }))
		]);

		const outcomes = [first, second];
		const winner = outcomes.find((outcome) => !outcome.error);
		const loser = outcomes.find((outcome) => outcome.error);
		expect(winner).toBeDefined();
		expect(loser?.error).toBeInstanceOf(ApiException);
		expect((loser.error as ApiException).getStatus()).toBe(409);
		// The stored row is one edit, whole, at the next version — never a mix of the two.
		expect(create).toHaveBeenCalledTimes(1);
		expect(approvals.create).toHaveBeenCalledTimes(1);
		expect(store.row.version).toBe(2);
		// The recreate stores the winning body alone: a member it leaves out is the column's default.
		expect([
			{ name: undefined, equipmentId: 'equipment-2' },
			{ name: 'Projector', equipmentId: undefined }
		]).toContainEqual({ name: store.row.name, equipmentId: store.row.equipmentId });
	});

	it('refuses an edit based on a version the row has moved on from, stated in the body', async () => {
		const { service, store, create } = setUp({ name: 'Laptop', status: 1, version: 5 });
		const { edit } = editor(service);

		const { error } = await settled(edit({ status: 1, name: 'Stale', version: 4 }));

		expect(error).toBeInstanceOf(ApiException);
		expect((error as ApiException).getStatus()).toBe(409);
		expect((error as ApiException).details).toMatchObject({ expectedVersion: 4, actualVersion: 5 });
		expect(create).not.toHaveBeenCalled();
		expect(store.row).toMatchObject({ name: 'Laptop', version: 5 });
	});

	it('answers the recreated row at the next version, for the editor to base the next edit on', async () => {
		const { service } = setUp({ name: 'Laptop', status: 1, version: 5 });
		const { edit } = editor(service);

		const edited = await edit({ status: 1, name: 'Projector', version: 5 });

		expect(edited).toMatchObject({ name: 'Projector', version: 6 });
	});
});

describe('PUT /equipment-sharing/approval|refuse/:id — the status write', () => {
	beforeEach(() => asUser());
	afterEach(() => jest.restoreAllMocks());

	it('is a compare-and-set on the version it read, and answers the row at the next version', async () => {
		const { service, store } = setUp({ name: 'Laptop', status: 1, version: 2 });

		const decided = await service.updateStatusEquipmentSharingByAdmin(ID, RequestApprovalStatusTypesEnum.APPROVED);

		expect(store.statements).toEqual([
			`update ${JSON.stringify({ id: ID, version: 2 })} ${JSON.stringify({ status: RequestApprovalStatusTypesEnum.APPROVED })}`
		]);
		expect(decided).toMatchObject({ status: RequestApprovalStatusTypesEnum.APPROVED, version: 3 });
	});

	it('does not revert an edit that landed after its read: 409, and the edit stands', async () => {
		const { service, store } = setUp({ name: 'Laptop', status: 1, version: 2 });
		const read = (service.findOneByIdString as jest.Mock).getMockImplementation();
		(service.findOneByIdString as jest.Mock).mockImplementationOnce(async (id: string) => {
			const row = await read(id);
			// An edit lands between the decision's read and its write.
			store.row = { ...store.row, name: 'Projector', version: 3 };
			return row;
		});

		const error = await service
			.updateStatusEquipmentSharingByAdmin(ID, RequestApprovalStatusTypesEnum.APPROVED)
			.catch((reason) => reason);

		expect(error).toBeInstanceOf(ApiException);
		expect(error.getStatus()).toBe(409);
		expect(store.row).toMatchObject({ name: 'Projector', status: 1, version: 3 });
	});
});

describe('POST /equipment-sharing — an upsert of a stored sharing', () => {
	afterEach(() => jest.restoreAllMocks());

	it('claims the version the check read, then upserts the checked payload without the body’s version', async () => {
		asUser();
		const { service, store, create } = setUp({ name: 'Laptop', status: 1, version: 7 });

		await service.storeCreate({ id: ID, name: 'Projector', version: 7 } as any, (payload) =>
			service.create(payload as any)
		);

		expect(store.statements[0]).toBe(
			`update ${JSON.stringify({ id: ID, version: 7 })} ${JSON.stringify({ version: 8 })}`
		);
		const [payload] = create.mock.calls[0] as [Row];
		expect(payload).not.toHaveProperty('version');
		expect(payload).toMatchObject({ id: ID, name: 'Projector', organizationId: ORG });
	});

	it('uses the version the check read when the body states none', async () => {
		asUser();
		const { service, store } = setUp({ name: 'Laptop', status: 1, version: 7 });

		await service.storeCreate({ id: ID, name: 'Projector' } as any, (payload) => service.create(payload as any));

		expect(store.statements[0]).toBe(
			`update ${JSON.stringify({ id: ID, version: 7 })} ${JSON.stringify({ version: 8 })}`
		);
	});

	it('refuses, before it writes anything, an upsert based on a version the row has moved on from', async () => {
		asUser();
		const { service, store, create } = setUp({ name: 'Laptop', status: 1, version: 7 });

		const error = await service
			.storeCreate({ id: ID, name: 'Stale', version: 6 } as any, (payload) => service.create(payload as any))
			.catch((reason) => reason);

		expect(error).toBeInstanceOf(ApiException);
		expect(error.getStatus()).toBe(409);
		expect(create).not.toHaveBeenCalled();
		expect(store.row).toMatchObject({ name: 'Laptop', version: 7 });
	});

	it('claims nothing for a new row, and never stores a version the body states for it', async () => {
		asUser();
		const { service, store, create } = setUp(null);

		await service.storeCreate({ name: 'New', status: 1, version: 9 } as any, (payload) =>
			service.create(payload as any)
		);

		expect(store.statements.filter((statement) => statement.startsWith('update'))).toEqual([]);
		const [payload] = create.mock.calls[0] as [Row];
		expect(payload).not.toHaveProperty('version');
		expect(store.row.version).toBe(1);
	});

	it('claims nothing for a stored sharing outside the caller’s organization, which the upsert refuses as before', async () => {
		asUser(RolesEnum.MANAGER, OTHER_ORG);
		const { service, store } = setUp({ name: 'Laptop', status: 1, version: 7 });
		// The upsert itself is the CRUD base's, whose boundary refusal its own specs cover: here it is reached.
		const upsert = jest.fn(async () => undefined);

		await service.storeCreate({ id: ID, name: 'Projector', organizationId: ORG } as any, upsert);

		expect(store.statements.filter((statement) => statement.startsWith('update'))).toEqual([]);
		expect(upsert).toHaveBeenCalledTimes(1);
	});
});
