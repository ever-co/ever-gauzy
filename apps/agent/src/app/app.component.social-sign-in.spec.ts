/**
 * The agent's provider (social) sign-in never finished: its main process never sent `social_auth_success`, and the
 * renderer then sent `auth_success`, which only the timer's main process handles (the agent's listens for
 * `AUTH_SUCCESS`). The sign-in window now finishes it as the password and e-mail code sign-ins do, and an address with
 * several workspaces goes to the shared workspace picker.
 *
 * The component is built directly with stand-ins: the library entry points are mocked down to the tokens it names, as
 * loading `@gauzy/desktop-ui-lib` for real pulls every desktop feature module into a spec that uses none of them.
 */
jest.mock('@gauzy/desktop-ui-lib', () => ({
	ActivityWatchElectronService: class ActivityWatchElectronService {},
	AuthService: class AuthService {},
	AuthStrategy: class AuthStrategy {},
	ElectronService: class ElectronService {},
	LanguageElectronService: class LanguageElectronService {},
	Store: class Store {},
	TokenRefreshService: class TokenRefreshService {}
}));
jest.mock('./app.service', () => ({ AppService: class AppService {} }));
jest.mock('@nebular/theme', () => ({ NbToastrService: class NbToastrService {} }));
jest.mock('@ngx-translate/core', () => ({ TranslateService: class TranslateService {} }));
jest.mock('@ngneat/until-destroy', () => ({ UntilDestroy: () => (target: unknown) => target }));

import { of, throwError } from 'rxjs';
import { AppComponent } from './app.component';

describe('AppComponent — provider sign-in', () => {
	const user = { id: 'user-1', tenantId: 'tenant-1', employee: { id: 'employee-1', organizationId: 'org-1' } };

	let handlers: Record<string, (event: unknown, arg: unknown) => void>;
	let ipcRenderer: { on: jest.Mock; removeListener: jest.Mock; send: jest.Mock };
	let appService: { getUserDetail: jest.Mock };
	let authStrategy: { storeAuthenticationData: jest.Mock };
	let authService: { electronAuthentication: jest.Mock; switchWorkspace: jest.Mock };
	let router: { navigate: jest.Mock };
	let toastrService: { show: jest.Mock };
	let component: AppComponent;

	/** Let the handlers' promise continuations run */
	const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

	beforeEach(() => {
		handlers = {};
		ipcRenderer = {
			on: jest.fn((channel: string, handler: (event: unknown, arg: unknown) => void) => {
				handlers[channel] = handler;
			}),
			removeListener: jest.fn(),
			send: jest.fn()
		};
		appService = { getUserDetail: jest.fn(async () => user) };
		authStrategy = { storeAuthenticationData: jest.fn() };
		authService = {
			electronAuthentication: jest.fn(() => of(undefined)),
			switchWorkspace: jest.fn(() => of({ user, token: 'pair-access', refresh_token: 'pair-refresh' }))
		};
		router = { navigate: jest.fn(async () => true) };
		toastrService = { show: jest.fn() };

		component = new AppComponent(
			{ ipcRenderer } as any,
			appService as any,
			authStrategy as any,
			authService as any,
			router as any,
			{} as any,
			{} as any,
			toastrService as any,
			{ run: (fn: () => unknown) => fn() } as any,
			{} as any,
			{ setupActivitiesCollection: jest.fn() } as any,
			{ initialize: jest.fn() } as any,
			{ start: jest.fn() } as any
		);
		component.ngAfterViewInit();
	});

	it('finishes a sign-in that matched one employee through AUTH_SUCCESS, with a token pair, as the other sign-ins do', async () => {
		jest.spyOn(component, 'jwtDecode').mockResolvedValue({ employeeId: 'employee-1', tenantId: 'tenant-1' });

		handlers['social_auth_success']({}, { token: 'provider-jwt', userId: 'user-1' });
		await flush();

		// The provider's access token first (the pair is asked with it), then the pair of the user's own workspace
		expect(authService.switchWorkspace).toHaveBeenCalledWith('tenant-1');
		expect(authStrategy.storeAuthenticationData).toHaveBeenNthCalledWith(1, { user, token: 'provider-jwt' });
		const session = { user, token: 'pair-access', refresh_token: 'pair-refresh' };
		expect(authStrategy.storeAuthenticationData).toHaveBeenLastCalledWith(session);
		expect(authService.electronAuthentication).toHaveBeenCalledWith(session);
		// `auth_success` is the timer's channel: the agent's main process never hears it
		expect(ipcRenderer.send).not.toHaveBeenCalledWith('auth_success', expect.anything());
	});

	it('keeps the employee the token pair names (a user employed in several organizations)', async () => {
		jest.spyOn(component, 'jwtDecode').mockResolvedValue({ employeeId: 'employee-1', tenantId: 'tenant-1' });
		const otherEmployee = { id: 'employee-2', organizationId: 'org-2', organization: { id: 'org-2' } };
		authService.switchWorkspace.mockReturnValue(
			of({ user: { id: 'user-1', employee: otherEmployee }, token: 'pair-access', refresh_token: 'pair-refresh' })
		);

		handlers['social_auth_success']({}, { token: 'provider-jwt', userId: 'user-1' });
		await flush();

		const session = {
			user: { ...user, employee: otherEmployee },
			token: 'pair-access',
			refresh_token: 'pair-refresh'
		};
		expect(authStrategy.storeAuthenticationData).toHaveBeenLastCalledWith(session);
		expect(authService.electronAuthentication).toHaveBeenCalledWith(session);
	});

	it('goes on with the access token alone when no token pair is issued', async () => {
		jest.spyOn(component, 'jwtDecode').mockResolvedValue({ employeeId: 'employee-1', tenantId: 'tenant-1' });
		jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		authService.switchWorkspace.mockReturnValue(throwError(() => new Error('refused')));

		handlers['social_auth_success']({}, { token: 'provider-jwt', userId: 'user-1' });
		await flush();

		expect(authStrategy.storeAuthenticationData).toHaveBeenLastCalledWith({ user, token: 'provider-jwt' });
		expect(authService.electronAuthentication).toHaveBeenCalledWith({ user, token: 'provider-jwt' });
	});

	it('refuses an account that is not an employee', async () => {
		jest.spyOn(component, 'jwtDecode').mockResolvedValue({ tenantId: 'tenant-1' });

		handlers['social_auth_success']({}, { token: 'provider-jwt', userId: 'user-1' });
		await flush();

		expect(toastrService.show).toHaveBeenCalled();
		expect(authStrategy.storeAuthenticationData).not.toHaveBeenCalled();
		expect(authService.electronAuthentication).not.toHaveBeenCalled();
	});

	it('opens the workspace picker with the one-time code in the navigation state, not the URL', async () => {
		handlers['social_auth_workspaces']({}, { email: 'a@example.com', code: '123456' });
		await flush();

		expect(router.navigate).toHaveBeenCalledWith(['/auth/magic-sign-in'], {
			state: { email: 'a@example.com', code: '123456' }
		});
	});

	it('opens no picker without an e-mail and a code', async () => {
		handlers['social_auth_workspaces']({}, { email: 'a@example.com' });
		handlers['social_auth_workspaces']({}, undefined);
		await flush();

		expect(router.navigate).not.toHaveBeenCalled();
	});
});
