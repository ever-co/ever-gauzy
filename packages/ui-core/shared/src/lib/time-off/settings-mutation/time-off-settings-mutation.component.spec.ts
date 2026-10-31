import { ITimeOffPolicy } from '@gauzy/contracts';
import { TimeOffSettingsMutationComponent } from './time-off-settings-mutation.component';

/**
 * The policy dialog's "Refuse approvals the leave balance cannot cover" checkbox (ever-co/ever-gauzy#10183). An
 * approval takes the leave's days from the balance even when that overdraws it; a policy can opt in to refusing
 * such approvals instead. The real methods run on a bare instance: no template or DI is needed.
 */
describe('TimeOffSettingsMutationComponent requireSufficientBalance', () => {
	const setup = (policy?: Partial<ITimeOffPolicy>) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const component: any = Object.create(TimeOffSettingsMutationComponent.prototype);
		Object.assign(component, {
			policy,
			organizationId: 'org-1',
			organization: { id: 'org-1', tenantId: 'tenant-1' },
			selectedEmployees: ['employee-1'],
			dialogRef: { close: jest.fn() }
		});
		component._initializeForm();
		return component;
	};

	it('is off for a new policy, and the dialog sends it', () => {
		const component = setup();

		component.name = 'Vacation';
		component.addOrEditPolicy();

		expect(component.requireSufficientBalance).toBe(false);
		expect(component.dialogRef.close).toHaveBeenCalledWith({
			name: 'Vacation',
			organizationId: 'org-1',
			tenantId: 'tenant-1',
			employees: ['employee-1'],
			requiresApproval: false,
			paid: true,
			requireSufficientBalance: false
		});
	});

	it("starts from the edited policy's setting", () => {
		expect(setup({ name: 'Vacation', paid: true, requireSufficientBalance: true }).requireSufficientBalance).toBe(
			true
		);
		expect(setup({ name: 'Vacation', paid: true }).requireSufficientBalance).toBe(false);
	});

	it('sends the checkbox as ticked', () => {
		const component = setup({ name: 'Vacation', paid: false, requiresApproval: true });

		component.changeRequireSufficientBalance(true);
		component.addOrEditPolicy();

		expect(component.dialogRef.close).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Vacation',
				requiresApproval: true,
				paid: false,
				requireSufficientBalance: true
			})
		);
	});
});
