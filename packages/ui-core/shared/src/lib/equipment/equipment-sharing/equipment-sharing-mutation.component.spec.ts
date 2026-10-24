import { HttpErrorResponse } from '@angular/common/http';
import { RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import { EquipmentSharingMutationComponent } from './equipment-sharing-mutation.component';

/**
 * The API writes an edit of an equipment sharing only at the version it is based on (ever-co/ever-gauzy#11384): the
 * body's `version`, else the version the server reads when the edit arrives. The edit dialog sent none, so the server
 * used what it read at save time, and a decision (or another edit) saved while the dialog was open was overwritten by
 * the dialog's columns — its `status` among them, read when the dialog opened. The dialog now sends the version of
 * the row it was opened on, and a `409 ENTITY_VERSION_CONFLICT` closes it with a notice so the page reads its list
 * again.
 */
describe('EquipmentSharingMutationComponent.onSaveRequest', () => {
	const { REQUESTED } = RequestApprovalStatusTypesEnum;
	const ORG = 'org-a';
	const TENANT = 'tenant-a';

	const conflict = () =>
		new HttpErrorResponse({
			status: 409,
			error: {
				statusCode: 409,
				error: 'Conflict',
				message: 'The equipment sharing changed since you read it. Read it again and reapply your change.',
				code: 'ENTITY_VERSION_CONFLICT',
				details: { id: 'sharing-1', expectedVersion: 4, actualVersion: 5 }
			}
		});

	/** The real method, run on a stand-in for the dialog with the form filled in. */
	const setup = (equipmentSharing?: Record<string, unknown>) => {
		const component: any = {
			loading: false,
			equipmentSharing,
			requestStatus: REQUESTED,
			selectedOrganization: { id: ORG, tenantId: TENANT },
			form: {
				value: {
					equipment: 'equipment-1',
					equipmentSharingPolicyId: 'policy-1',
					shareRequestDay: new Date('2026-10-24T09:00:00.000Z'),
					shareStartDay: new Date('2026-10-26T09:00:00.000Z'),
					shareEndDay: new Date('2026-10-28T09:00:00.000Z'),
					name: 'Projector'
				}
			},
			equipmentItems: [{ id: 'equipment-1', name: 'Projector' }],
			employees: [],
			teams: [],
			selectedEmployees: [],
			selectedTeams: [],
			equipmentSharingService: {
				update: jest.fn(async (id: string, input: Record<string, unknown>) => ({ ...input, id })),
				create: jest.fn(async (input: Record<string, unknown>) => ({ ...input, id: 'sharing-new' }))
			},
			toastrService: { warning: jest.fn() },
			errorHandlingService: { handleError: jest.fn() },
			closeDialog: jest.fn()
		};
		const save = () => EquipmentSharingMutationComponent.prototype.onSaveRequest.call(component);
		return { component, save };
	};

	it('sends the version of the row the dialog was opened on', async () => {
		const { component, save } = setup({ id: 'sharing-1', status: REQUESTED, version: 4 });

		await save();

		expect(component.equipmentSharingService.update).toHaveBeenCalledWith(
			'sharing-1',
			expect.objectContaining({ version: 4, status: REQUESTED, name: 'Projector' })
		);
		expect(component.closeDialog).toHaveBeenCalledWith(expect.objectContaining({ id: 'sharing-1', version: 4 }));
	});

	it('sends no version for a row read without one: the server then uses the version it reads', async () => {
		const { component, save } = setup({ id: 'sharing-1', status: REQUESTED });

		await save();

		const [, input] = component.equipmentSharingService.update.mock.calls[0];
		expect(input).not.toHaveProperty('version');
	});

	it('files a new request without a version', async () => {
		const { component, save } = setup();

		await save();

		const [input, organizationId] = component.equipmentSharingService.create.mock.calls[0];
		expect(organizationId).toBe(ORG);
		expect(input).not.toHaveProperty('version');
		expect(component.equipmentSharingService.update).not.toHaveBeenCalled();
	});

	it('on 409 ENTITY_VERSION_CONFLICT says someone else changed it and closes without a result, so the page reloads', async () => {
		const { component, save } = setup({ id: 'sharing-1', status: REQUESTED, version: 4 });
		component.equipmentSharingService.update.mockRejectedValue(conflict());

		await expect(save()).resolves.toBeUndefined();

		expect(component.toastrService.warning).toHaveBeenCalledWith(
			'EQUIPMENT_SHARING_PAGE.MESSAGES.CHANGED_BY_SOMEONE_ELSE'
		);
		expect(component.closeDialog).toHaveBeenCalledTimes(1);
		expect(component.closeDialog).toHaveBeenCalledWith();
		expect(component.errorHandlingService.handleError).not.toHaveBeenCalled();
		expect(component.loading).toBe(false);
	});

	it('shows any other failure and keeps the dialog open, to retry', async () => {
		const { component, save } = setup({ id: 'sharing-1', status: REQUESTED, version: 4 });
		const failure = new HttpErrorResponse({ status: 400, error: { statusCode: 400, message: 'Bad Request' } });
		component.equipmentSharingService.update.mockRejectedValue(failure);

		await save();

		expect(component.errorHandlingService.handleError).toHaveBeenCalledWith(failure);
		expect(component.toastrService.warning).not.toHaveBeenCalled();
		expect(component.closeDialog).not.toHaveBeenCalled();
		expect(component.loading).toBe(false);
	});

	it('ignores a second click while the first save is in flight', async () => {
		const { component, save } = setup({ id: 'sharing-1', status: REQUESTED, version: 4 });
		component.loading = true;

		await save();

		expect(component.equipmentSharingService.update).not.toHaveBeenCalled();
	});
});
