import { TenantOnboardingComponent } from './tenant-onboarding.component';

/**
 * #8734 — POST /tenant refuses a user who already has a tenant ("Tenant already exists"), so a super admin
 * created with the default tenant could never get past this form. Such a user must only get the organization,
 * in their existing tenant; a user without a tenant still gets a new one first.
 */
describe('TenantOnboardingComponent.onboardUser', () => {
	const organization = { name: 'Acme' } as never;

	const setup = (user: { tenantId?: string }) => {
		const tenantService = {
			create: jest.fn().mockResolvedValue({ id: 'new-tenant' }),
			getCurrent: jest.fn().mockResolvedValue({ id: 'existing-tenant' })
		};
		const organizationsService = { create: jest.fn().mockResolvedValue({ id: 'org-1' }) };
		const router = { navigate: jest.fn() };
		const errorHandlingService = { handleError: jest.fn() };
		const store: Record<string, unknown> = { user };
		const component = new TenantOnboardingComponent(
			router as never,
			{} as never,
			organizationsService as never,
			tenantService as never,
			{ getMe: jest.fn().mockResolvedValue({ id: 'user-1', tenantId: 'existing-tenant' }) } as never,
			store as never,
			{ refreshToken: jest.fn() } as never,
			{ create: jest.fn() } as never,
			errorHandlingService as never
		);
		return { component, tenantService, organizationsService, router, errorHandlingService };
	};

	it('creates the organization in the existing tenant of a user who already has one', async () => {
		const { component, tenantService, organizationsService, router, errorHandlingService } = setup({
			tenantId: 'existing-tenant'
		});

		await component.onboardUser(organization);

		expect(tenantService.create).not.toHaveBeenCalled();
		expect(organizationsService.create).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Acme', tenant: { id: 'existing-tenant' } })
		);
		expect(errorHandlingService.handleError).not.toHaveBeenCalled();
		expect(router.navigate).toHaveBeenCalledWith(['/onboarding/complete']);
	});

	it('still creates a new tenant first for a user without one', async () => {
		const { component, tenantService, organizationsService } = setup({});

		await component.onboardUser(organization);

		expect(tenantService.create).toHaveBeenCalledWith({ name: 'Acme' });
		expect(tenantService.getCurrent).not.toHaveBeenCalled();
		expect(organizationsService.create).toHaveBeenCalledWith(
			expect.objectContaining({ tenant: { id: 'new-tenant' } })
		);
	});
});
