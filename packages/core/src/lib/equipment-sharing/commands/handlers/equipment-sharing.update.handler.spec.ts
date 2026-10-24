/**
 * `PUT /api/equipment-sharing/:id` is a delete-then-recreate that persists the body. The scope check read the
 * `equipmentId` / `equipmentSharingPolicyId` columns only, while the recreate also persisted the related objects
 * (`equipment: { id }`, `equipmentSharingPolicy: { id }`), which the ORM writes as the foreign key just the same: a
 * crafted body re-attached a sharing to another organization's equipment or policy of the same tenant (follow-up of
 * ever-co/ever-gauzy#11167).
 *
 * The services are replaced, so the suite does not load the entity graph (see `reference-scope.helper.spec.ts`).
 */
jest.mock('../../../request-approval/request-approval.service', () => ({ RequestApprovalService: class {} }));
jest.mock('../../equipment-sharing.service', () => ({ EquipmentSharingService: class {} }));
jest.mock('../../equipment-sharing.entity', () => ({ EquipmentSharing: class {} }));

import { EquipmentSharingUpdateCommand } from '../equipment-sharing.update.command';
import { EquipmentSharingUpdateHandler } from './equipment-sharing.update.handler';

const STORED = {
	id: 'sharing-1',
	tenantId: 'tenant-a',
	organizationId: 'org-1',
	name: 'Laptop for a week',
	version: 4
};

function setUp() {
	const sharingService = {
		findOneByIdString: jest.fn(async () => ({ ...STORED })),
		assertReferencesAreInScope: jest.fn(async () => undefined),
		deleteAtVersion: jest.fn(async (_id: string, _expected: number | null) => undefined),
		create: jest.fn(async (row: Record<string, unknown>) => ({ ...row }))
	};
	const approvalService = {
		delete: jest.fn(async () => ({ affected: 1 })),
		create: jest.fn(async (row: Record<string, unknown>) => row)
	};
	const handler = new EquipmentSharingUpdateHandler(sharingService as any, approvalService as any);
	return { handler, sharingService, approvalService };
}

function edit(input: Record<string, unknown>) {
	return new EquipmentSharingUpdateCommand('sharing-1', { name: 'Laptop for a week', ...input } as any);
}

describe('EquipmentSharingUpdateHandler — the rows an edit points at', () => {
	it.each([
		[
			'the policy',
			{ equipmentSharingPolicy: { id: 'other-orgs-policy' } },
			'equipmentSharingPolicyId',
			'other-orgs-policy'
		],
		['the equipment', { equipment: { id: 'other-orgs-equipment' } }, 'equipmentId', 'other-orgs-equipment']
	])('checks %s the related object names, in the stored row’s scope', async (_label, body, column, id) => {
		const { handler, sharingService } = setUp();

		await handler.execute(edit(body));

		expect(sharingService.assertReferencesAreInScope).toHaveBeenCalledWith(
			expect.objectContaining({ [column]: id }),
			{ tenantId: 'tenant-a', organizationId: 'org-1' }
		);
	});

	it('refuses a related object of another organization before anything is deleted or stored', async () => {
		const { handler, sharingService, approvalService } = setUp();
		sharingService.assertReferencesAreInScope.mockRejectedValueOnce(new Error('not available here'));

		await expect(handler.execute(edit({ equipmentSharingPolicy: { id: 'other-orgs-policy' } }))).rejects.toThrow(
			'not available here'
		);
		expect(sharingService.deleteAtVersion).not.toHaveBeenCalled();
		expect(approvalService.delete).not.toHaveBeenCalled();
		expect(sharingService.create).not.toHaveBeenCalled();
	});

	it('stores the id that was checked, as the column, and none of the related objects', async () => {
		const { handler, sharingService } = setUp();

		await handler.execute(
			edit({
				equipmentId: 'equipment-1',
				equipment: { id: 'equipment-2', name: 'Projector' },
				equipmentSharingPolicyId: 'policy-1',
				equipmentSharingPolicy: { id: 'policy-2' }
			})
		);

		const [checked] = sharingService.assertReferencesAreInScope.mock.calls[0] as unknown as [
			Record<string, unknown>
		];
		const [row] = sharingService.create.mock.calls[0] as [Record<string, unknown>];
		expect(row).toMatchObject({
			id: 'sharing-1',
			organizationId: 'org-1',
			tenantId: 'tenant-a',
			equipmentId: checked['equipmentId'],
			equipmentSharingPolicyId: checked['equipmentSharingPolicyId']
		});
		expect(row['equipmentId']).toBe('equipment-2');
		expect(row['equipmentSharingPolicyId']).toBe('policy-2');
		expect(row).not.toHaveProperty('equipment');
		expect(row).not.toHaveProperty('equipmentSharingPolicy');
	});

	it('pins the stored organization over one the body names as the related object', async () => {
		const { handler, sharingService } = setUp();

		await handler.execute(edit({ equipmentId: 'equipment-1', organization: { id: 'org-2' } }));

		const [row] = sharingService.create.mock.calls[0] as [Record<string, unknown>];
		expect(row).not.toHaveProperty('organization');
		expect(row['organizationId']).toBe('org-1');
	});

	it('hands the employees and the teams the body lists to the scope check, in the stored row’s scope', async () => {
		const { handler, sharingService } = setUp();
		const employees = [{ id: 'employee-1' }, 'employee-2'];
		const teams = [{ id: 'team-1' }];

		await handler.execute(edit({ employees, teams }));

		// The service holds each listed member to that organization (see reference-scope.helper.spec.ts).
		expect(sharingService.assertReferencesAreInScope).toHaveBeenCalledWith(
			expect.objectContaining({ employees, teams }),
			{ tenantId: 'tenant-a', organizationId: 'org-1' }
		);
	});

	it('still edits a sharing whose body names its rows by column only', async () => {
		const { handler, sharingService } = setUp();

		await handler.execute(edit({ equipmentId: 'equipment-1', equipmentSharingPolicyId: 'policy-1' }));

		const [row] = sharingService.create.mock.calls[0] as [Record<string, unknown>];
		expect(row).toMatchObject({ equipmentId: 'equipment-1', equipmentSharingPolicyId: 'policy-1' });
	});
});

describe('EquipmentSharingUpdateHandler — an edit is a compare-and-set on the version it read (ever-co/ever-gauzy#11359)', () => {
	it('removes the row only at the version the server read when the body states none, and recreates it at the next', async () => {
		const { handler, sharingService, approvalService } = setUp();

		await handler.execute(edit({ equipmentId: 'equipment-1' }));

		expect(sharingService.deleteAtVersion).toHaveBeenCalledWith('sharing-1', 4);
		const [row] = sharingService.create.mock.calls[0] as [Record<string, unknown>];
		expect(row['version']).toBe(5);
		// The approval row is removed only once the sharing row was, and recreated beside it.
		expect(sharingService.deleteAtVersion.mock.invocationCallOrder[0]).toBeLessThan(
			approvalService.delete.mock.invocationCallOrder[0]
		);
		expect(approvalService.create).toHaveBeenCalledTimes(1);
	});

	it('removes the row only at the version the body states, and recreates it at the one after that', async () => {
		const { handler, sharingService } = setUp();

		await handler.execute(edit({ version: 3 }));

		expect(sharingService.deleteAtVersion).toHaveBeenCalledWith('sharing-1', 3);
		const [row] = sharingService.create.mock.calls[0] as [Record<string, unknown>];
		expect(row['version']).toBe(4);
	});

	it('accepts the version as the text a raw body may carry it in', async () => {
		const { handler, sharingService } = setUp();

		await handler.execute(edit({ version: '4' }));

		expect(sharingService.deleteAtVersion).toHaveBeenCalledWith('sharing-1', 4);
	});

	it.each([[0], [-1], [1.5], ['three'], [{ $gt: 0 }]])(
		'refuses a body version that is not one (%p) with 400, before anything is removed',
		async (version) => {
			const { handler, sharingService, approvalService } = setUp();

			await expect(handler.execute(edit({ version }))).rejects.toMatchObject({ status: 400 });
			expect(sharingService.deleteAtVersion).not.toHaveBeenCalled();
			expect(approvalService.delete).not.toHaveBeenCalled();
			expect(sharingService.create).not.toHaveBeenCalled();
		}
	);

	it('writes nothing more when the row has moved on: the 409 of the conditional removal stands', async () => {
		const { handler, sharingService, approvalService } = setUp();
		const conflict = Object.assign(new Error('changed since you read it'), { status: 409 });
		sharingService.deleteAtVersion.mockRejectedValueOnce(conflict);

		await expect(handler.execute(edit({ version: 3 }))).rejects.toBe(conflict);
		expect(approvalService.delete).not.toHaveBeenCalled();
		expect(sharingService.create).not.toHaveBeenCalled();
		expect(approvalService.create).not.toHaveBeenCalled();
	});

	it('removes a row stored without a version without a precondition, and recreates it at version 1', async () => {
		const { handler, sharingService } = setUp();
		sharingService.findOneByIdString.mockResolvedValueOnce({ ...STORED, version: null } as any);

		await handler.execute(edit({}));

		expect(sharingService.deleteAtVersion).toHaveBeenCalledWith('sharing-1', null);
		const [row] = sharingService.create.mock.calls[0] as [Record<string, unknown>];
		expect(row['version']).toBe(1);
	});
});
