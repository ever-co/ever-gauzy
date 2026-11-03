import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { UserApiTokenExpiryEnum } from '@gauzy/contracts';
import { UserApiTokenService } from './user-api-token.service';

describe('UserApiTokenService', () => {
	let service: UserApiTokenService;
	let http: HttpTestingController;
	const base = `${API_PREFIX}/user-api-tokens`;

	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
		service = TestBed.inject(UserApiTokenService);
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		http.verify();
	});

	describe('whether the server has API tokens on', () => {
		it.each([
			[{ enabled: true }, true],
			[{ enabled: false }, false],
			[{}, false],
			[null, false]
		])('%j reads as %s', async (answer, expected) => {
			const read = firstValueFrom(service.enabled$);

			http.expectOne({ method: 'GET', url: `${base}/config` }).flush(answer);

			await expect(read).resolves.toBe(expected);
		});

		it('reads as off when the request fails, as on an older API without the route', async () => {
			const read = firstValueFrom(service.enabled$);

			http.expectOne(`${base}/config`).flush('Not Found', { status: 404, statusText: 'Not Found' });

			await expect(read).resolves.toBe(false);
		});

		it('asks once, however many read it', async () => {
			const first = firstValueFrom(service.enabled$);
			const second = firstValueFrom(service.enabled$);

			http.expectOne(`${base}/config`).flush({ enabled: true });

			await expect(first).resolves.toBe(true);
			await expect(second).resolves.toBe(true);
			await expect(firstValueFrom(service.enabled$)).resolves.toBe(true);
		});
	});

	it('lists the user’s tokens', async () => {
		const read = firstValueFrom(service.list());

		http.expectOne({ method: 'GET', url: base }).flush({ items: [], total: 0 });

		await expect(read).resolves.toEqual({ items: [], total: 0 });
	});

	it('creates a token and hands back the one answer that carries it', async () => {
		const input = { name: 'Agent', expiry: UserApiTokenExpiryEnum.DAYS_90 };
		const read = firstValueFrom(service.create(input));

		const request = http.expectOne(base);
		expect(request.request.method).toBe('POST');
		expect(request.request.body).toEqual(input);
		request.flush({ id: 'token-1', token: 'gzp_plain' });

		await expect(read).resolves.toMatchObject({ token: 'gzp_plain' });
	});

	it('revokes by id', async () => {
		const done = firstValueFrom(service.revoke('token-1'));

		const request = http.expectOne(`${base}/token-1`);
		expect(request.request.method).toBe('DELETE');
		request.flush(null, { status: 204, statusText: 'No Content' });

		await expect(done).resolves.toBeNull();
	});

	it('lets a failed create reach the caller', async () => {
		const read = firstValueFrom(service.create({ name: 'Agent', expiry: UserApiTokenExpiryEnum.NEVER }));

		http.expectOne(base).flush({ message: 'too many' }, { status: 400, statusText: 'Bad Request' });

		await expect(read).rejects.toBeInstanceOf(HttpErrorResponse);
	});
});
