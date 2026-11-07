import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { UserApiTokenService } from '../services/user-api-token/user-api-token.service';
import { userApiTokensEnabledGuard } from './user-api-tokens-enabled.guard';

@Component({ selector: 'ga-user-api-tokens-guard-page', standalone: true, template: '' })
class PageComponent {}

/**
 * The API tokens page opens only while the server has API tokens on; otherwise the visitor lands on the Settings pages.
 * The guard runs in a real router, as the settings routes use it.
 */
describe('userApiTokensEnabledGuard', () => {
	async function openPage(enabled: boolean): Promise<string> {
		TestBed.configureTestingModule({
			providers: [
				{ provide: UserApiTokenService, useValue: { enabled$: of(enabled) } },
				provideRouter([
					{
						path: 'pages/settings/api-tokens',
						canActivate: [userApiTokensEnabledGuard],
						component: PageComponent
					},
					{ path: 'pages/settings', component: PageComponent }
				])
			]
		});
		const harness = await RouterTestingHarness.create();
		await harness.navigateByUrl('/pages/settings/api-tokens');
		return TestBed.inject(Router).url;
	}

	it('opens the page while the server has API tokens on', async () => {
		await expect(openPage(true)).resolves.toBe('/pages/settings/api-tokens');
	});

	it('sends the visitor to the Settings pages otherwise', async () => {
		await expect(openPage(false)).resolves.toBe('/pages/settings');
	});
});
