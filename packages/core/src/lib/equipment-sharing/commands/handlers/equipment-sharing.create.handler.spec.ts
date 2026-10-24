/**
 * `POST /api/equipment-sharing/organization/:id` (and the `createEquipmentSharing` field) is open to whoever may make a
 * request — `EQUIPMENT_MAKE_REQUEST`, which every employee holds — and stored the status the body carried: the form
 * sends `APPROVED` itself when the chosen equipment auto-approves its shares, so any requester could file an approved
 * sharing for any equipment and skip the approver.
 *
 * The services and the request context are replaced, so the suite does not load the entity graph (see
 * `reference-scope.helper.spec.ts`).
 */
const granted: string[] = [];

jest.mock('../../../core/context', () => ({
	RequestContext: {
		currentTenantId: () => 'tenant-a',
		hasAnyPermission: (permissions: string[]) => permissions.some((permission) => granted.includes(permission))
	}
}));
jest.mock('../../../request-approval/request-approval.service', () => ({ RequestApprovalService: class {} }));
jest.mock('../../equipment-sharing.service', () => ({ EquipmentSharingService: class {} }));
jest.mock('../../equipment-sharing.entity', () => ({ EquipmentSharing: class {} }));

import { PermissionsEnum, RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import { EquipmentSharingCreateCommand } from '../equipment-sharing.create.command';
import { EquipmentSharingCreateHandler } from './equipment-sharing.create.handler';

const { REQUESTED, APPROVED, REFUSED } = RequestApprovalStatusTypesEnum;

function setUp(autoApproveShare: boolean) {
	const sharingService = {
		assertReferencesAreInScope: jest.fn(async () => undefined),
		autoApprovesShare: jest.fn(async () => autoApproveShare),
		create: jest.fn(async (row: Record<string, unknown>) => ({ id: 'sharing-1', ...row }))
	};
	const approvalService = { create: jest.fn(async (row: Record<string, unknown>) => row) };
	const handler = new EquipmentSharingCreateHandler(sharingService as any, approvalService as any);
	return { handler, sharingService, approvalService };
}

function file(input: Record<string, unknown>) {
	return new EquipmentSharingCreateCommand('org-1', { name: 'Laptop for a week', ...input } as any);
}

describe('EquipmentSharingCreateHandler — the status a request is filed with', () => {
	beforeEach(() => {
		granted.length = 0;
		granted.push(PermissionsEnum.EQUIPMENT_MAKE_REQUEST);
	});

	it('files a requester’s APPROVED request as REQUESTED when the equipment does not auto-approve', async () => {
		const { handler, sharingService, approvalService } = setUp(false);

		const sharing = await handler.execute(file({ equipmentId: 'equipment-1', status: APPROVED }));

		expect(sharing.status).toBe(REQUESTED);
		expect(sharingService.create).toHaveBeenCalledWith(expect.objectContaining({ status: REQUESTED }));
		expect(approvalService.create).toHaveBeenCalledWith(expect.objectContaining({ status: REQUESTED }));
		expect(sharingService.autoApprovesShare).toHaveBeenCalledWith('equipment-1', {
			tenantId: 'tenant-a',
			organizationId: 'org-1'
		});
	});

	it('approves a requester’s request when the stored equipment auto-approves, whatever the body says', async () => {
		const { handler, approvalService } = setUp(true);

		const sharing = await handler.execute(file({ equipmentId: 'equipment-1', status: REFUSED }));

		expect(sharing.status).toBe(APPROVED);
		expect(approvalService.create).toHaveBeenCalledWith(expect.objectContaining({ status: APPROVED }));
	});

	it('reads the equipment the row will point at: the related object’s id over a different equipmentId', async () => {
		const { handler, sharingService } = setUp(true);

		await handler.execute(
			file({ equipmentId: 'auto-approving', equipment: { id: 'needs-approval', autoApproveShare: true } })
		);

		expect(sharingService.autoApprovesShare).toHaveBeenCalledWith('needs-approval', expect.anything());
		expect(sharingService.assertReferencesAreInScope).toHaveBeenCalledWith(
			expect.objectContaining({ equipmentId: 'needs-approval' }),
			{ tenantId: 'tenant-a', organizationId: 'org-1' }
		);
		const [row] = sharingService.create.mock.calls[0] as [Record<string, unknown>];
		expect(row['equipmentId']).toBe('needs-approval');
		expect(row).not.toHaveProperty('equipment');
	});

	it('checks and stores the policy the related object names, not only the policy column', async () => {
		const { handler, sharingService } = setUp(false);

		await handler.execute(
			file({
				equipmentId: 'equipment-1',
				equipmentSharingPolicyId: 'policy-1',
				equipmentSharingPolicy: { id: 'other-orgs-policy' }
			})
		);

		expect(sharingService.assertReferencesAreInScope).toHaveBeenCalledWith(
			expect.objectContaining({ equipmentSharingPolicyId: 'other-orgs-policy' }),
			{ tenantId: 'tenant-a', organizationId: 'org-1' }
		);
		const [row] = sharingService.create.mock.calls[0] as [Record<string, unknown>];
		expect(row['equipmentSharingPolicyId']).toBe('other-orgs-policy');
		expect(row).not.toHaveProperty('equipmentSharingPolicy');
	});

	it('refuses a policy of another organization named as the related object, before anything is stored', async () => {
		const { handler, sharingService, approvalService } = setUp(false);
		sharingService.assertReferencesAreInScope.mockRejectedValueOnce(new Error('not available here'));

		await expect(
			handler.execute(file({ equipmentId: 'equipment-1', equipmentSharingPolicy: { id: 'other-orgs-policy' } }))
		).rejects.toThrow('not available here');
		expect(sharingService.assertReferencesAreInScope).toHaveBeenCalledWith(
			expect.objectContaining({ equipmentSharingPolicyId: 'other-orgs-policy' }),
			expect.anything()
		);
		expect(sharingService.create).not.toHaveBeenCalled();
		expect(approvalService.create).not.toHaveBeenCalled();
	});

	it('files a new row: a body-supplied id, which create() would upsert, is not stored', async () => {
		const { handler, sharingService } = setUp(false);

		await handler.execute(file({ id: 'stored-sharing-of-org-2', equipmentId: 'equipment-1' }));

		const [row] = sharingService.create.mock.calls[0] as [Record<string, unknown>];
		expect(row).not.toHaveProperty('id');
		expect(row).toMatchObject({ equipmentId: 'equipment-1', organizationId: 'org-1' });
	});

	it('pins the route’s organization over one the body names as the related object', async () => {
		const { handler, sharingService } = setUp(false);

		await handler.execute(file({ equipmentId: 'equipment-1', organization: { id: 'org-2' } }));

		const [row] = sharingService.create.mock.calls[0] as [Record<string, unknown>];
		expect(row).not.toHaveProperty('organization');
		expect(row['organizationId']).toBe('org-1');
	});

	it('keeps the status a caller who may decide a sharing chose', async () => {
		for (const permission of [
			PermissionsEnum.EQUIPMENT_APPROVE_REQUEST,
			PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT
		]) {
			granted.length = 0;
			granted.push(permission);
			const { handler, sharingService } = setUp(false);

			expect((await handler.execute(file({ equipmentId: 'equipment-1', status: APPROVED }))).status).toBe(
				APPROVED
			);
			expect(sharingService.autoApprovesShare).not.toHaveBeenCalled();
		}
	});

	it('files a decider’s request without a status as REQUESTED', async () => {
		granted.push(PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT);
		const { handler } = setUp(true);

		expect((await handler.execute(file({ equipmentId: 'equipment-1' }))).status).toBe(REQUESTED);
	});

	it('refuses equipment outside the organization before anything is stored', async () => {
		const { handler, sharingService, approvalService } = setUp(true);
		sharingService.assertReferencesAreInScope.mockRejectedValueOnce(new Error('not available here'));

		await expect(handler.execute(file({ equipmentId: 'other-org-equipment' }))).rejects.toThrow(
			'not available here'
		);
		expect(sharingService.create).not.toHaveBeenCalled();
		expect(approvalService.create).not.toHaveBeenCalled();
	});

	it('files a new sharing at the starting version, whatever version the body carries', async () => {
		const { handler, sharingService } = setUp(false);

		await handler.execute(file({ equipmentId: 'equipment-1', version: 9 }));

		const [row] = sharingService.create.mock.calls[0] as [Record<string, unknown>];
		expect(row).not.toHaveProperty('version');
	});
});
