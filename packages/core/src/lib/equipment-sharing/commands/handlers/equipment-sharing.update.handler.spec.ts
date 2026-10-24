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

const STORED = { id: 'sharing-1', tenantId: 'tenant-a', organizationId: 'org-1', name: 'Laptop for a week' };

function setUp() {
	const sharingService = {
		findOneByIdString: jest.fn(async () => ({ ...STORED })),
		assertReferencesAreInScope: jest.fn(async () => undefined),
		delete: jest.fn(async () => ({ affected: 1 })),
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
		expect(sharingService.delete).not.toHaveBeenCalled();
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

	it('still edits a sharing whose body names its rows by column only', async () => {
		const { handler, sharingService } = setUp();

		await handler.execute(edit({ equipmentId: 'equipment-1', equipmentSharingPolicyId: 'policy-1' }));

		const [row] = sharingService.create.mock.calls[0] as [Record<string, unknown>];
		expect(row).toMatchObject({ equipmentId: 'equipment-1', equipmentSharingPolicyId: 'policy-1' });
	});
});
