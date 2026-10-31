import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { RegistrationConfigService } from '../services/auth/registration-config.service';
import { registrationEnabledGuard } from './registration-enabled.guard';

@Component({ selector: 'ga-registration-guard-page', standalone: true, template: '' })
class PageComponent {}

/**
 * The register page opens only while the server accepts public sign-ups; otherwise the visitor lands on sign-in.
 * The guard runs in a real router, as the auth routes use it.
 */
describe('registrationEnabledGuard', () => {
	async function openRegisterPage(enabled: boolean): Promise<string> {
		TestBed.configureTestingModule({
			providers: [
				{ provide: RegistrationConfigService, useValue: { registrationEnabled$: of(enabled) } },
				provideRouter([
					{ path: 'auth/register', canActivate: [registrationEnabledGuard], component: PageComponent },
					{ path: 'auth/login', component: PageComponent }
				])
			]
		});
		const harness = await RouterTestingHarness.create();
		await harness.navigateByUrl('/auth/register');
		return TestBed.inject(Router).url;
	}

	it('opens the register page while sign-ups are open', async () => {
		await expect(openRegisterPage(true)).resolves.toBe('/auth/register');
	});

	it('sends the visitor to sign in while sign-ups are closed', async () => {
		await expect(openRegisterPage(false)).resolves.toBe('/auth/login');
	});
});
