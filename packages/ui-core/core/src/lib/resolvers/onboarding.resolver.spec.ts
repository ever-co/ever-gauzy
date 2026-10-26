import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { IUser } from '@gauzy/contracts';
import { ErrorHandlingService, UsersService } from '../services';
import { OnboardingResolver } from './onboarding.resolver';

/**
 * `/onboarding/tenant` is where a user creates their first organization. The resolver used to send every user
 * who already had a tenant to `/onboarding/complete`, so a user with a tenant but no organization yet (the
 * super admin created with the default tenant on a fresh install) could never reach the form.
 */
describe('OnboardingResolver', () => {
	const resolve = async (user: Partial<IUser>) => {
		const router = { navigate: jest.fn() };
		const usersService = { getMe: jest.fn().mockResolvedValue(user) };
		TestBed.configureTestingModule({
			providers: [
				{ provide: Router, useValue: router },
				{ provide: UsersService, useValue: usersService },
				{ provide: ErrorHandlingService, useValue: { handleError: jest.fn() } }
			]
		});
		// The resolver reads nothing from the route, so it declares no parameters
		const resolver = OnboardingResolver as () => Observable<IUser | null>;
		const result = await firstValueFrom(TestBed.runInInjectionContext(() => resolver()));
		return { result, router, usersService };
	};

	afterEach(() => TestBed.resetTestingModule());

	it('keeps a user who has a tenant but no organization on the form', async () => {
		const { result, router, usersService } = await resolve({
			id: 'user-1',
			tenantId: 'tenant-1',
			organizations: []
		});

		expect(usersService.getMe).toHaveBeenCalledWith(['organizations']);
		expect(router.navigate).not.toHaveBeenCalled();
		expect(result).toMatchObject({ id: 'user-1' });
	});

	it('sends a user who already has an organization to the completion page', async () => {
		const { router } = await resolve({
			id: 'user-1',
			tenantId: 'tenant-1',
			organizations: [{ id: 'uo-1' }] as never
		});

		expect(router.navigate).toHaveBeenCalledWith(['/onboarding/complete']);
	});

	it('keeps a user without a tenant on the form', async () => {
		const { router } = await resolve({ id: 'user-1' });

		expect(router.navigate).not.toHaveBeenCalled();
	});
});
