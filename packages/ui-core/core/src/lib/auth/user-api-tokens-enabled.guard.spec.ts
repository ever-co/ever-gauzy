import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';
import { UserApiTokenService } from '../services/user-api-token/user-api-token.service';
import { userApiTokensEnabledGuard } from './user-api-tokens-enabled.guard';

describe('userApiTokensEnabledGuard', () => {
	const settings = {} as UrlTree;

	const run = (enabled: boolean) => {
		TestBed.configureTestingModule({
			providers: [
				{ provide: UserApiTokenService, useValue: { enabled$: of(enabled) } },
				{ provide: Router, useValue: { createUrlTree: jest.fn(() => settings) } }
			]
		});
		return firstValueFrom(
			TestBed.runInInjectionContext(() => userApiTokensEnabledGuard(null, null)) as Observable<boolean | UrlTree>
		);
	};

	it('opens the page while the server has API tokens on', async () => {
		await expect(run(true)).resolves.toBe(true);
	});

	it('sends the visitor to the Settings pages otherwise', async () => {
		await expect(run(false)).resolves.toBe(settings);
		expect(TestBed.inject(Router).createUrlTree).toHaveBeenCalledWith(['/pages/settings']);
	});
});
