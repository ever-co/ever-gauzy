import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Store } from '../store/store.service';
import { UsersService } from './users.service';

/**
 * The app asks for the signed-in user from several places as it starts (`AppInitService.init()`, the pages
 * entry point, route resolvers), each a full `GET /user/me`. Identical requests made moments apart share one
 * answer; a write through this service, or a different user, token or parameters, asks again.
 */
describe('UsersService.getMe', () => {
	let service: UsersService;
	let backend: HttpTestingController;
	let store = { userId: 'user-1', token: 'token-a' };
	const me = { id: 'user-1', email: 'ada@example.com' };

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Store, useValue: store }]
		});
		service = TestBed.inject(UsersService);
		backend = TestBed.inject(HttpTestingController);
		store.userId = 'user-1';
		store.token = 'token-a';
	});

	afterEach(() => backend.verify());

	it('answers identical requests made moments apart with one round trip', async () => {
		const first = service.getMe(['role', 'tenant'], true);
		const second = service.getMe(['tenant', 'role'], true);

		const requests = backend.match((request) => request.url.endsWith('/user/me'));
		expect(requests).toHaveLength(1);
		expect(requests[0].request.params.get('includeEmployee')).toBe('true');
		requests[0].flush(me);

		expect(await first).toEqual(me);
		expect(await second).toEqual(me);
	});

	it('asks again for other relations, another token, or another user', async () => {
		service.getMe(['role']);
		service.getMe(['role', 'tenant']);
		store.token = 'token-b';
		service.getMe(['role']);
		store.userId = 'user-2';
		service.getMe(['role']);

		const requests = backend.match((request) => request.url.endsWith('/user/me'));
		expect(requests).toHaveLength(4);
		requests.forEach((request) => request.flush(me));
	});

	it('asks again after a write through this service', async () => {
		service.getMe();
		backend.expectOne((request) => request.url.endsWith('/user/me')).flush(me);

		service.update('user-1', { firstName: 'Ada' });
		backend.expectOne((request) => request.method === 'PUT').flush({});

		service.getMe();
		backend.expectOne((request) => request.url.endsWith('/user/me')).flush(me);
	});

	it('does not keep a read that overlapped a write, once the write has settled', async () => {
		const writing = service.update('user-1', { firstName: 'Ada' });
		// A route read while the save is pending remembers the old row...
		const stale = service.getMe();
		backend.expectOne((request) => request.url.endsWith('/user/me')).flush({ ...me, firstName: 'Old' });
		expect(await stale).toEqual({ ...me, firstName: 'Old' });
		backend.expectOne((request) => request.method === 'PUT').flush({});
		await writing;
		// ...and is not served again after the save.
		const fresh = service.getMe();
		backend.expectOne((request) => request.url.endsWith('/user/me')).flush({ ...me, firstName: 'Ada' });
		expect(await fresh).toEqual({ ...me, firstName: 'Ada' });
	});

	it('asks again after a failed request', async () => {
		const failed = service.getMe();
		backend
			.expectOne((request) => request.url.endsWith('/user/me'))
			.flush('offline', {
				status: 503,
				statusText: 'Service Unavailable'
			});
		await expect(failed).rejects.toBeTruthy();

		const retried = service.getMe();
		backend.expectOne((request) => request.url.endsWith('/user/me')).flush(me);
		expect(await retried).toEqual(me);
	});
});
