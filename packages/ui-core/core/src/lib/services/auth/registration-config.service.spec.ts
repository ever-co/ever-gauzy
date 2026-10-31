import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { isRegistrationOpen, RegistrationConfigService } from './registration-config.service';

/**
 * #5784 / #7821: the sign-in pages ask `GET /api/auth/registration/config` whether to show their Register links.
 * Only an explicit `enabled: false` hides them, so an older API (no such route) keeps them as they always were.
 */
describe('isRegistrationOpen', () => {
	it('reads only an explicit `enabled: false` as closed', () => {
		expect(isRegistrationOpen({ enabled: false })).toBe(false);
		expect(isRegistrationOpen({ enabled: true })).toBe(true);
		expect(isRegistrationOpen({})).toBe(true);
		expect(isRegistrationOpen(null)).toBe(true);
		expect(isRegistrationOpen(undefined)).toBe(true);
	});
});

describe('RegistrationConfigService', () => {
	let service: RegistrationConfigService;
	let backend: HttpTestingController;

	beforeEach(() => {
		service = TestBed.inject(RegistrationConfigService);
		backend = TestBed.inject(HttpTestingController);
	});

	afterEach(() => backend.verify());

	const answer = () => backend.expectOne((request) => request.url.endsWith('/auth/registration/config'));

	it('reports a closed sign-up', async () => {
		const result = service.isRegistrationEnabled();
		answer().flush({ enabled: false });

		await expect(result).resolves.toBe(false);
	});

	it('asks the server once and shares the answer', async () => {
		const first = service.isRegistrationEnabled();
		const second = service.isRegistrationEnabled();
		answer().flush({ enabled: true });

		await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
		await expect(service.isRegistrationEnabled()).resolves.toBe(true);
	});

	it('keeps registration shown when the server cannot answer (an older API)', async () => {
		const result = service.isRegistrationEnabled();
		answer().flush('Not Found', { status: 404, statusText: 'Not Found' });

		await expect(result).resolves.toBe(true);
	});
});
