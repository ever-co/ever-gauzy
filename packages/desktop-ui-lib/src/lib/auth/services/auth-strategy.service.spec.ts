import { HttpErrorResponse } from '@angular/common/http';
import { IAuthResponse } from '@gauzy/contracts';
import { NbAuthResult } from '@nebular/auth';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { AuthStrategy } from './auth-strategy.service';

/**
 * An organization switch replaces the tokens, and the API replaces the refresh token held before. A token refresh
 * (proactive, or after a 401) for the organization left must neither overwrite the new organization's tokens nor, when
 * the API refuses the replaced refresh token, end the session: refreshes and the credentials part of a switch never
 * overlap (`replaceCredentials`), and an answer overtaken by stored credentials is dropped.
 */
describe('AuthStrategy token refresh and credential replacement', () => {
	/** A JWT `isValidToken` accepts: three parts, an `exp` an hour ahead. */
	const jwt = (subject: string): string =>
		[
			btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
			btoa(JSON.stringify({ sub: subject, exp: Math.floor(Date.now() / 1000) + 3600 })),
			'signature'
		].join('.');

	const refreshed = (subject: string) => ({ token: jwt(subject), refresh_token: `refresh-${subject}` });

	const switchResponse = (organizationId: string): IAuthResponse =>
		({
			token: jwt(organizationId),
			refresh_token: `refresh-${organizationId}`,
			user: {
				id: 'user-1',
				tenantId: 'tenant-1',
				employee: { id: `employee-${organizationId}`, organizationId }
			}
		}) as IAuthResponse;

	/** Let pending promise continuations run. */
	const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

	let authService: { refreshToken: jest.Mock };
	let store: Record<string, unknown>;
	let strategy: AuthStrategy;

	beforeEach(() => {
		authService = { refreshToken: jest.fn() };
		store = { token: jwt('org-a'), refreshToken: 'refresh-org-a', organizationId: 'org-a' };
		strategy = new AuthStrategy(authService as any, store as any, { isElectron: false } as any);
		jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('holds a refresh asked for during a switch, then refreshes with the refresh token the switch left', async () => {
		let finishSwitch: () => void = () => undefined;
		const switching = strategy.replaceCredentials(() => new Promise<void>((resolve) => (finishSwitch = resolve)));
		await flush();

		authService.refreshToken.mockReturnValue(of(refreshed('org-b-2')));
		const refresh = firstValueFrom(strategy.refreshToken());
		await flush();
		expect(authService.refreshToken).not.toHaveBeenCalled();

		// The switch stores organization B's tokens, then ends.
		strategy.storeAuthenticationData(switchResponse('org-b'));
		finishSwitch();
		await switching;

		const result: NbAuthResult = await refresh;
		expect(authService.refreshToken).toHaveBeenCalledWith('refresh-org-b');
		expect(result.isSuccess()).toBe(true);
		expect(store.refreshToken).toBe('refresh-org-b-2');
	});

	it('starts a switch only once the refresh under way has landed', async () => {
		const response$ = new Subject<{ token: string; refresh_token: string }>();
		authService.refreshToken.mockReturnValue(response$);
		const refresh = firstValueFrom(strategy.refreshToken());

		const operation = jest.fn(async () => store.refreshToken);
		const switching = strategy.replaceCredentials(operation);
		await flush();
		expect(operation).not.toHaveBeenCalled();

		response$.next(refreshed('org-a-2'));
		response$.complete();

		await expect(refresh).resolves.toBeInstanceOf(NbAuthResult);
		// The switch runs with the refreshed credentials.
		await expect(switching).resolves.toBe('refresh-org-a-2');
		expect(operation).toHaveBeenCalledTimes(1);
	});

	it('drops a refresh answer that lands after other credentials were stored', async () => {
		const response$ = new Subject<{ token: string; refresh_token: string }>();
		authService.refreshToken.mockReturnValue(response$);
		const refresh = firstValueFrom(strategy.refreshToken());

		strategy.storeAuthenticationData(switchResponse('org-b'));
		const organizationBToken = store.token;

		response$.next(refreshed('org-a-2'));
		response$.complete();

		const result: NbAuthResult = await refresh;
		// Organization B's tokens stay; the caller goes on with them (a retried request carries the stored token).
		expect(result.isSuccess()).toBe(true);
		expect(store.token).toBe(organizationBToken);
		expect(store.refreshToken).toBe('refresh-org-b');
	});

	it('does not report the refusal of a replaced refresh token as a failed refresh', async () => {
		const response$ = new Subject<{ token: string; refresh_token: string }>();
		authService.refreshToken.mockReturnValue(response$);
		const refresh = firstValueFrom(strategy.refreshToken());

		strategy.storeAuthenticationData(switchResponse('org-b'));
		response$.error(new HttpErrorResponse({ status: 401 }));

		const result: NbAuthResult = await refresh;
		expect(result.isSuccess()).toBe(true);
		expect(store.refreshToken).toBe('refresh-org-b');
	});

	it('still reports a refused refresh when the credentials stayed the same', async () => {
		authService.refreshToken.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));

		const result: NbAuthResult = await firstValueFrom(strategy.refreshToken());

		expect(result.isSuccess()).toBe(false);
		expect(store.refreshToken).toBe('refresh-org-a');
	});
});
