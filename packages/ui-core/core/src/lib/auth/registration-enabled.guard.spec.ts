import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { firstValueFrom, isObservable, Observable, of } from 'rxjs';
import { RegistrationConfigService } from '../services/auth/registration-config.service';
import { registrationEnabledGuard } from './registration-enabled.guard';

/**
 * The register page opens only while the server accepts public sign-ups; otherwise the visitor lands on sign-in.
 */
describe('registrationEnabledGuard', () => {
	function run(enabled: boolean): Promise<boolean | UrlTree> {
		TestBed.configureTestingModule({
			providers: [{ provide: RegistrationConfigService, useValue: { registrationEnabled$: of(enabled) } }]
		});
		const result = runInInjectionContext(TestBed.inject(EnvironmentInjector), () =>
			registrationEnabledGuard({} as never, { url: '/auth/register' } as never)
		);
		if (!isObservable(result)) {
			throw new Error('The guard answers with an observable');
		}
		return firstValueFrom(result as Observable<boolean | UrlTree>);
	}

	it('opens the register page while sign-ups are open', async () => {
		await expect(run(true)).resolves.toBe(true);
	});

	it('sends the visitor to sign in while sign-ups are closed', async () => {
		const result = await run(false);

		expect(result).toBeInstanceOf(UrlTree);
		expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/auth/login');
	});
});
