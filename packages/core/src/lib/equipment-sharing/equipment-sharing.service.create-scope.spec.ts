import '../core/entities/internal';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EquipmentSharingController } from './equipment-sharing.controller';
import { EquipmentSharingService } from './equipment-sharing.service';
import {
	asTenantUser,
	createCrossTenantFixture,
	createTenantFixture
} from '../core/testing/tenant-isolation/tenant-isolation.fixtures';

/**
 * `POST /equipment-sharing` (the CRUD base's create, an upsert by id) is checked as the row it will store: the
 * organization the body states, else that of the stored sharing a body id names, else the caller's; the equipment
 * and the policy the body states, else the stored row's (`EquipmentSharingService.assertCreateIsInScope`).
 *
 * `reference-scope.helper.spec.ts` covers the rules with the stored row handed in. This suite runs them through the
 * service and the controller against a store double, so the lookup that finds the stored row (tenant-scoped,
 * soft-deleted rows included, string ids only) and the refusal before anything is persisted are pinned too.
 */
const { tenantA, tenantB } = createCrossTenantFixture();
const orgA = tenantA.organizationId;
const orgB = createTenantFixture({ tenantId: tenantA.tenantId }).organizationId;

/** The equipment and the policies a sharing can point at, by organization. */
const REFERENCED = [
	{ table: 'equipment', id: 'equipment-of-a', tenantId: tenantA.tenantId, organizationId: orgA },
	{ table: 'equipment', id: 'equipment-of-b', tenantId: tenantA.tenantId, organizationId: orgB },
	{ table: 'equipment', id: 'equipment-of-b2', tenantId: tenantA.tenantId, organizationId: orgB },
	{ table: 'equipment_sharing_policy', id: 'policy-of-a', tenantId: tenantA.tenantId, organizationId: orgA },
	{ table: 'equipment_sharing_policy', id: 'policy-of-b', tenantId: tenantA.tenantId, organizationId: orgB }
];

/** The stored sharings a body id can name. */
const SHARINGS = [
	{
		id: 'sharing-of-b',
		tenantId: tenantA.tenantId,
		organizationId: orgB,
		equipmentId: 'equipment-of-b',
		equipmentSharingPolicyId: 'policy-of-b',
		deletedAt: null as Date | null
	},
	{
		id: 'retired-sharing-of-b',
		tenantId: tenantA.tenantId,
		organizationId: orgB,
		equipmentId: 'equipment-of-b',
		equipmentSharingPolicyId: 'policy-of-b',
		deletedAt: new Date('2026-10-01T00:00:00.000Z')
	},
	{
		id: 'sharing-of-tenant-b',
		tenantId: tenantB.tenantId,
		organizationId: tenantB.organizationId,
		equipmentId: 'equipment-of-tenant-b',
		equipmentSharingPolicyId: null,
		deletedAt: null as Date | null
	}
];

const STORED_SHARING_SELECT = {
	id: true,
	organizationId: true,
	equipmentId: true,
	equipmentSharingPolicyId: true,
	// The version an upsert of the stored row is a compare-and-set on (`EquipmentSharingService.storeCreate`).
	version: true
};

/** The service over a store double: the sharing repository answers by id and tenant, as a database would. */
function setUp() {
	const findOne = jest.fn(
		async ({ where, withDeleted }: { where: Record<string, unknown>; withDeleted?: boolean }) => {
			const row = SHARINGS.find(
				(sharing) =>
					sharing.id === where['id'] &&
					sharing.tenantId === where['tenantId'] &&
					(withDeleted === true || sharing.deletedAt === null)
			);
			if (!row) {
				return null;
			}
			const { deletedAt: _deletedAt, ...columns } = row;
			return columns;
		}
	);
	const lookup = jest.fn(
		async (table: string, { where }: { where: Record<string, unknown> }) =>
			REFERENCED.find(
				(row) =>
					row.table === table &&
					row.id === where['id'] &&
					row.tenantId === where['tenantId'] &&
					(where['organizationId'] === undefined || row.organizationId === where['organizationId'])
			) ?? null
	);
	const service = new EquipmentSharingService(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		{ metadata: { tableName: 'equipment_sharing' }, findOne, manager: { findOne: lookup } } as any,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		{} as any,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		{} as any,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		{ dbConnectionOptions: { type: 'postgres' } } as any
	);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const storing = (body: Record<string, unknown>) => service.assertCreateIsInScope(body as any);
	return { service, findOne, lookup, storing };
}

/** The lookup `assertReferencesAreInScope` runs for one reference. */
const checked = (table: string, id: string, organizationId: string): [string, { where: Record<string, unknown> }] => [
	table,
	{ where: { id, tenantId: tenantA.tenantId, organizationId } }
];

describe('EquipmentSharingService.assertCreateIsInScope — a create is checked as the row it stores', () => {
	let restore: () => void;

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('checks a new row in the caller’s organization, and stores it there with its references as columns', async () => {
		const { findOne, lookup, storing } = setUp();

		const payload = await storing({
			name: 'Laptop for a week',
			equipment: { id: 'equipment-of-a' },
			equipmentSharingPolicyId: 'policy-of-a'
		});

		expect(findOne).not.toHaveBeenCalled();
		expect(lookup.mock.calls).toEqual([
			checked('equipment', 'equipment-of-a', orgA),
			checked('equipment_sharing_policy', 'policy-of-a', orgA)
		]);
		expect(payload).toEqual({
			name: 'Laptop for a week',
			equipmentId: 'equipment-of-a',
			equipmentSharingPolicyId: 'policy-of-a',
			organizationId: orgA
		});
	});

	it('refuses a new row that names another organization’s equipment or policy', async () => {
		for (const body of [
			{ equipmentId: 'equipment-of-b' },
			{ equipment: { id: 'equipment-of-b' } },
			{ equipmentId: 'equipment-of-a', equipmentSharingPolicy: { id: 'policy-of-b' } }
		]) {
			const { storing } = setUp();

			await expect(storing(body)).rejects.toBeInstanceOf(ForbiddenException);
		}
	});

	it('reads the stored row a body id names in the caller’s tenant, soft-deleted rows included', async () => {
		const { findOne, storing } = setUp();

		await storing({ id: 'sharing-of-b' });

		expect(findOne).toHaveBeenCalledTimes(1);
		expect(findOne).toHaveBeenCalledWith({
			where: { id: 'sharing-of-b', tenantId: tenantA.tenantId },
			select: STORED_SHARING_SELECT,
			withDeleted: true
		});
	});

	it('checks the references an upsert that omits them keeps, in the stored row’s organization', async () => {
		const { lookup, storing } = setUp();

		const payload = await storing({ id: 'sharing-of-b', notes: 'extended' });

		expect(lookup.mock.calls).toEqual([
			checked('equipment', 'equipment-of-b', orgB),
			checked('equipment_sharing_policy', 'policy-of-b', orgB)
		]);
		// The stored row keeps its organization, not the caller's, and the payload states what was checked.
		expect(payload).toEqual({
			id: 'sharing-of-b',
			notes: 'extended',
			organizationId: orgB,
			equipmentId: 'equipment-of-b',
			equipmentSharingPolicyId: 'policy-of-b'
		});
	});

	it('answers the triple it checked, so the upsert keeps no reference of the stored row', async () => {
		const { storing } = setUp();

		// An equipment-only change, checked in the organization the row was read in.
		const payload = await storing({ id: 'sharing-of-b', equipmentId: 'equipment-of-b2' });

		// A concurrent upsert may move the stored row to another organization, with that organization's equipment
		// and policy, before this write lands: stating all three, the write never pairs this equipment with them.
		expect(payload).toEqual({
			id: 'sharing-of-b',
			organizationId: orgB,
			equipmentId: 'equipment-of-b2',
			equipmentSharingPolicyId: 'policy-of-b'
		});
	});

	it('answers a reference checked as absent as cleared, not omitted', async () => {
		const { storing } = setUp();

		await expect(storing({ equipmentId: 'equipment-of-a' })).resolves.toEqual({
			organizationId: orgA,
			equipmentId: 'equipment-of-a',
			equipmentSharingPolicyId: null
		});
	});

	it('checks a reference the body states in the stored row’s organization when the body omits the organization', async () => {
		const { lookup, storing } = setUp();

		await expect(storing({ id: 'sharing-of-b', equipmentId: 'equipment-of-a' })).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(lookup).toHaveBeenCalledWith(...checked('equipment', 'equipment-of-a', orgB));
	});

	it('refuses moving a stored sharing to another organization while it keeps its references', async () => {
		for (const body of [
			{ id: 'sharing-of-b', organizationId: orgA },
			{ id: 'sharing-of-b', organization: { id: orgA } }
		]) {
			const { lookup, storing } = setUp();

			await expect(storing(body)).rejects.toBeInstanceOf(ForbiddenException);
			expect(lookup).toHaveBeenCalledWith(...checked('equipment', 'equipment-of-b', orgA));
		}
	});

	it('reads a soft-deleted stored sharing as the upsert does: its retained references are checked too', async () => {
		const { lookup, storing } = setUp();

		await expect(storing({ id: 'retired-sharing-of-b' })).resolves.toEqual({
			id: 'retired-sharing-of-b',
			organizationId: orgB,
			equipmentId: 'equipment-of-b',
			equipmentSharingPolicyId: 'policy-of-b'
		});
		expect(lookup.mock.calls).toEqual([
			checked('equipment', 'equipment-of-b', orgB),
			checked('equipment_sharing_policy', 'policy-of-b', orgB)
		]);

		await expect(storing({ id: 'retired-sharing-of-b', organizationId: orgA })).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(lookup).toHaveBeenLastCalledWith(...checked('equipment', 'equipment-of-b', orgA));
	});

	it('does not read a sharing of another tenant: its id is checked as a new row of the caller’s organization', async () => {
		const { findOne, lookup, storing } = setUp();

		const payload = await storing({ id: 'sharing-of-tenant-b', equipmentId: 'equipment-of-a' });

		expect(findOne).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: 'sharing-of-tenant-b', tenantId: tenantA.tenantId } })
		);
		expect(lookup.mock.calls).toEqual([checked('equipment', 'equipment-of-a', orgA)]);
		expect(payload).toMatchObject({ id: 'sharing-of-tenant-b', organizationId: orgA });
	});

	it('refuses a body id that is not a string before anything is read', async () => {
		for (const id of [{ $ne: null }, 42, ['sharing-of-b'], true]) {
			const { findOne, lookup, storing } = setUp();

			await expect(storing({ id, equipmentId: 'equipment-of-a' })).rejects.toBeInstanceOf(BadRequestException);
			expect(findOne).not.toHaveBeenCalled();
			expect(lookup).not.toHaveBeenCalled();
		}
	});
});

describe('EquipmentSharingController.create — POST /equipment-sharing stores only what was checked', () => {
	let restore: () => void;

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	function controllerOver() {
		const { service, lookup } = setUp();
		const create = jest
			.spyOn(service, 'create')
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.mockImplementation(async (row) => ({ id: 'created', ...(row as object) }) as any);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const controller = new EquipmentSharingController(service, {} as any);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const post = (body: Record<string, unknown>) => controller.create(body as any);
		return { create, lookup, post };
	}

	it('persists nothing when the body names a reference outside the organization the row is stored in', async () => {
		for (const body of [
			{ equipmentId: 'equipment-of-b' },
			{ equipmentId: 'equipment-of-a', equipmentSharingPolicy: { id: 'policy-of-b' } },
			{ id: 'sharing-of-b', organization: { id: orgA } },
			{ id: 'retired-sharing-of-b', organizationId: orgA }
		]) {
			const { create, post } = controllerOver();

			await expect(post(body)).rejects.toBeInstanceOf(ForbiddenException);
			expect(create).not.toHaveBeenCalled();
		}
	});

	it('persists nothing for a body id that is not a string', async () => {
		const { create, lookup, post } = controllerOver();

		await expect(post({ id: { $ne: null } })).rejects.toBeInstanceOf(BadRequestException);
		expect(lookup).not.toHaveBeenCalled();
		expect(create).not.toHaveBeenCalled();
	});

	it('persists the checked payload: each reference once as its column, in the organization it was checked in', async () => {
		const { create, post } = controllerOver();

		await post({
			name: 'Laptop for a week',
			equipment: { id: 'equipment-of-a', autoApproveShare: true },
			equipmentSharingPolicy: { id: 'policy-of-a' }
		});

		expect(create).toHaveBeenCalledTimes(1);
		expect(create).toHaveBeenCalledWith({
			name: 'Laptop for a week',
			equipmentId: 'equipment-of-a',
			equipmentSharingPolicyId: 'policy-of-a',
			organizationId: orgA
		});
	});

	it('persists, beside a changed equipment, the organization and the policy it checked rather than leaving them to the upsert', async () => {
		const { create, post } = controllerOver();

		await post({ id: 'sharing-of-b', equipmentId: 'equipment-of-b2' });

		expect(create).toHaveBeenCalledTimes(1);
		expect(create).toHaveBeenCalledWith({
			id: 'sharing-of-b',
			organizationId: orgB,
			equipmentId: 'equipment-of-b2',
			equipmentSharingPolicyId: 'policy-of-b'
		});
	});
});
