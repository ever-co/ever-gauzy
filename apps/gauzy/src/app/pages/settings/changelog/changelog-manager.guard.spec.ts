import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { RolesEnum } from '@gauzy/contracts';
import { AuthService } from '@gauzy/ui-core/core';
import { CHANGELOG_MANAGER_FALLBACK_URL, changelogManagerGuard } from './changelog-manager.guard';

/** Only a super admin, as the API says, may open the What's New management page. */
describe('changelogManagerGuard', () => {
	const fallback = {} as UrlTree;
	let hasRole: jest.Mock<Observable<boolean>>;
	let parseUrl: jest.Mock;

	const run = () =>
		TestBed.runInInjectionContext(() =>
			changelogManagerGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
		);

	beforeEach(() => {
		hasRole = jest.fn(() => of(true));
		parseUrl = jest.fn(() => fallback);
		TestBed.configureTestingModule({
			providers: [
				{ provide: AuthService, useValue: { hasRole } },
				{ provide: Router, useValue: { parseUrl } }
			]
		});
	});

	it('lets a super admin in, asking the API for the role', async () => {
		await expect(run()).resolves.toBe(true);
		expect(hasRole).toHaveBeenCalledWith([RolesEnum.SUPER_ADMIN]);
	});

	it('sends anyone else back to the settings', async () => {
		hasRole.mockReturnValueOnce(of(false));

		await expect(run()).resolves.toBe(fallback);
		expect(parseUrl).toHaveBeenCalledWith(CHANGELOG_MANAGER_FALLBACK_URL);
	});

	it('keeps the page closed when the role cannot be checked', async () => {
		hasRole.mockReturnValueOnce(throwError(() => new Error('offline')));

		await expect(run()).resolves.toBe(fallback);
	});
});
