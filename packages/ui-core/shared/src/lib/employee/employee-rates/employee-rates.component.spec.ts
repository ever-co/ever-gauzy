import { UntypedFormBuilder } from '@angular/forms';
import { PermissionsEnum } from '@gauzy/contracts';
import { NEVER, of } from 'rxjs';
import { EmployeeRatesComponent } from './employee-rates.component';

/**
 * Changing one's own rates needs CHANGE_OWN_RATES, which super admins and admins hold by default. Without it, the
 * rates tab shows a person's own rates read-only, with a hint to ask an admin, and saves nothing; someone else's
 * rates stay editable for whoever may edit them.
 */
describe('EmployeeRatesComponent and one’s own rates', () => {
	const OWN = { id: 'employee-own', billRateValue: 25, payPeriod: 'WEEKLY' };
	const COLLEAGUE = { id: 'employee-colleague', billRateValue: 40, payPeriod: 'WEEKLY' };

	const setup = (employee: { id: string }, permissions: PermissionsEnum[], userEmployeeId = 'employee-own') => {
		const store = {
			user: { employeeId: userEmployeeId },
			selectedOrganization: { id: 'organization-1' },
			hasPermission: (permission: PermissionsEnum) => permissions.includes(permission)
		};
		const employeeStore = { selectedEmployee$: of(employee), employeeForm: undefined as unknown };
		const candidateStore = { selectedCandidate$: NEVER };
		const component = new EmployeeRatesComponent(
			new UntypedFormBuilder(),
			store as never,
			employeeStore as never,
			candidateStore as never
		);
		component.isEmployee = true;
		component.ngOnInit();
		return { component, employeeStore };
	};

	it('shows one’s own rates read-only and saves nothing without CHANGE_OWN_RATES', async () => {
		const { component, employeeStore } = setup(OWN, [PermissionsEnum.ORG_EMPLOYEES_EDIT]);

		expect(component.ownRatesLocked).toBe(true);
		expect(component.form.disabled).toBe(true);
		expect(component.form.getRawValue()).toEqual(expect.objectContaining({ billRateValue: 25 }));

		await component.onSubmit();
		expect(employeeStore.employeeForm).toBeUndefined();
	});

	it('recognizes one’s own record whatever the letter case of the id', () => {
		const { component } = setup(OWN, [], 'EMPLOYEE-OWN');

		expect(component.ownRatesLocked).toBe(true);
	});

	it('lets a holder of CHANGE_OWN_RATES edit their own rates', async () => {
		const { component, employeeStore } = setup(OWN, [PermissionsEnum.CHANGE_OWN_RATES]);

		expect(component.ownRatesLocked).toBe(false);
		expect(component.form.enabled).toBe(true);

		await component.onSubmit();
		expect(employeeStore.employeeForm).toEqual(expect.objectContaining({ billRateValue: 25 }));
	});

	it("keeps a colleague's rates editable for a rate editor without CHANGE_OWN_RATES", () => {
		const { component } = setup(COLLEAGUE, [PermissionsEnum.ORG_EMPLOYEES_EDIT]);

		expect(component.ownRatesLocked).toBe(false);
		expect(component.form.enabled).toBe(true);
	});
});
