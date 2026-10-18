import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NgxPermissionsService } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';
import { ErrorHandlingService } from '../notification/error-handling.service';
import { Store } from '../store/store.service';
import { PermissionsService } from './permissions.service';

/**
 * `GET /role-permissions/me` (~164 KB) is loaded by `AppInitService.init()` and again by the pages entry point
 * as the app starts, with the same rows each time. Identical requests made moments apart share one answer.
 */
describe('PermissionsService.loadPermissions', () => {
	let service: PermissionsService;
	let backend: HttpTestingController;
	let ngxPermissions: { flushPermissions: jest.Mock; loadPermissions: jest.Mock };
	const store: { userId: string | null; token: string; userRolePermissions?: unknown } = {
		userId: 'user-1',
		token: 'token-a'
	};
	const rows = [{ permission: PermissionsEnum.ORG_TEAM_VIEW }, { permission: PermissionsEnum.PROFILE_EDIT }];

	beforeEach(() => {
		ngxPermissions = { flushPermissions: jest.fn(), loadPermissions: jest.fn() };
		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: Store, useValue: store },
				{ provide: NgxPermissionsService, useValue: ngxPermissions },
				{ provide: ErrorHandlingService, useValue: { handleError: jest.fn() } }
			]
		});
		service = TestBed.inject(PermissionsService);
		backend = TestBed.inject(HttpTestingController);
		store.userId = 'user-1';
		store.token = 'token-a';
	});

	afterEach(() => backend.verify());

	it('loads the permissions once for two loads made moments apart, and applies them both times', async () => {
		const first = service.loadPermissions();
		const second = service.loadPermissions();

		backend.expectOne((request) => request.url.endsWith('/role-permissions/me')).flush(rows);
		await Promise.all([first, second]);

		expect(store.userRolePermissions).toEqual(rows);
		expect(ngxPermissions.loadPermissions).toHaveBeenCalledTimes(2);
		expect(ngxPermissions.loadPermissions).toHaveBeenLastCalledWith([
			PermissionsEnum.ORG_TEAM_VIEW,
			PermissionsEnum.PROFILE_EDIT
		]);
	});

	it('loads again for another user or token, and after forgetPermissions()', async () => {
		service.getPermissions();
		store.token = 'token-b';
		service.getPermissions();
		service.forgetPermissions();
		service.getPermissions();

		const requests = backend.match((request) => request.url.endsWith('/role-permissions/me'));
		expect(requests).toHaveLength(3);
		requests.forEach((request) => request.flush(rows));
	});

	it('does nothing without a signed-in user', async () => {
		store.userId = null;
		await service.loadPermissions();
		backend.expectNone((request) => request.url.endsWith('/role-permissions/me'));
	});
});
