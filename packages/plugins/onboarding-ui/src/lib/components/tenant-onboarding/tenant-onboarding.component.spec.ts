import { of } from 'rxjs';
import { readRememberedCheckoutSession, rememberCheckoutSession } from '@gauzy/ui-core/core';
import { TenantOnboardingComponent } from './tenant-onboarding.component';

/**
 * #8734 — POST /tenant refuses a user who already has a tenant ("Tenant already exists"), so a super admin
 * created with the default tenant could never get past this form. Such a user must only get the organization,
 * in their existing tenant; a user without a tenant still gets a new one first.
 */
describe('TenantOnboardingComponent.onboardUser', () => {
	const organization = { name: 'Acme' } as never;
	// `registerEmployeeFeature` runs in the background: the employee creation must have been requested
	// synchronously, so `employeesService.create` returns an observable that resolves at once.

	const setup = (user: { tenantId?: string }) => {
		const tenantService = {
			create: jest.fn().mockResolvedValue({ id: 'new-tenant' }),
			getCurrent: jest.fn().mockResolvedValue({ id: 'existing-tenant' })
		};
		const organizationsService = { create: jest.fn().mockResolvedValue({ id: 'org-1' }) };
		const router = { navigate: jest.fn() };
		const errorHandlingService = { handleError: jest.fn() };
		const store: Record<string, unknown> = { user };
		// After onboarding, /user/me reports the tenant the user now belongs to
		const usersService = {
			getMe: jest.fn().mockResolvedValue({ id: 'user-1', tenantId: user.tenantId ?? 'new-tenant' })
		};
		const employeesService = { create: jest.fn().mockReturnValue(of({})) };
		const component = new TenantOnboardingComponent(
			router as never,
			{} as never,
			organizationsService as never,
			tenantService as never,
			usersService as never,
			store as never,
			{ refreshToken: jest.fn() } as never,
			employeesService as never,
			errorHandlingService as never
		);
		return { component, tenantService, organizationsService, employeesService, router, errorHandlingService };
	};

	it('creates the organization in the existing tenant of a user who already has one', async () => {
		const { component, tenantService, organizationsService, router, errorHandlingService } = setup({
			tenantId: 'existing-tenant'
		});

		await component.onboardUser(organization);

		expect(tenantService.create).not.toHaveBeenCalled();
		expect(tenantService.getCurrent).toHaveBeenCalled();
		expect(organizationsService.create).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Acme', tenant: { id: 'existing-tenant' } })
		);
		expect(errorHandlingService.handleError).not.toHaveBeenCalled();
		expect(router.navigate).toHaveBeenCalledWith(['/onboarding/complete']);
	});

	it('still creates a new tenant first for a user without one', async () => {
		const { component, tenantService, organizationsService, employeesService } = setup({});
		// A buyer coming from the shared checkout: the remembered Checkout Session goes to the new tenant
		rememberCheckoutSession('cs_test_12345678');

		await component.onboardUser({ name: 'Acme', registerAsEmployee: true } as never);

		expect(tenantService.create).toHaveBeenCalledWith({
			name: 'Acme',
			stripeCheckoutSessionId: 'cs_test_12345678'
		});
		expect(readRememberedCheckoutSession()).toBeUndefined();
		expect(tenantService.getCurrent).not.toHaveBeenCalled();
		expect(organizationsService.create).toHaveBeenCalledWith(
			expect.objectContaining({ tenant: { id: 'new-tenant' } })
		);
		// The employee record is created in the new tenant
		expect(employeesService.create).toHaveBeenCalledWith(
			expect.objectContaining({ userId: 'user-1', organizationId: 'org-1', tenantId: 'new-tenant' })
		);
	});
});
