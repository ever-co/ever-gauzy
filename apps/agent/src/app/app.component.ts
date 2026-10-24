import { AfterViewInit, Component, HostBinding, NgZone, OnDestroy, OnInit, Renderer2, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { IAuthResponse, IUser } from '@gauzy/contracts';
import {
	ActivityWatchElectronService,
	AuthService,
	AuthStrategy,
	ElectronService,
	LanguageElectronService,
	Store,
	TokenRefreshService
} from '@gauzy/desktop-ui-lib';
import { NbToastrService } from '@nebular/theme';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AppService } from './app.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'agent-root',
	template: '<router-outlet></router-outlet>',
	styleUrls: ['./app.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [RouterOutlet]
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
	@HostBinding('class.login-small-height') isLoginPage = false;
	@HostBinding('class.setup-max-height') isSetupPage = false;
	private pingHostInterval: NodeJS.Timeout;

	constructor(
		private electronService: ElectronService,
		private appService: AppService,
		private authStrategy: AuthStrategy,
		private readonly authService: AuthService,
		private readonly router: Router,
		public readonly translate: TranslateService,
		private store: Store,
		private toastrService: NbToastrService,
		private _ngZone: NgZone,
		private _renderer: Renderer2,
		readonly activityWatchElectronService: ActivityWatchElectronService,
		readonly languageElectronService: LanguageElectronService,
		private readonly tokenRefreshService: TokenRefreshService
	) {
		activityWatchElectronService.setupActivitiesCollection();
	}

	ngOnInit(): void {
		this.loginStyleOverride();
		this.setupHeighStyleOverride();
		this.checkAuthValidation();
		const nebularLinkMedia = document.querySelector('link[media="print"]');
		if (nebularLinkMedia) this._renderer.setAttribute(nebularLinkMedia, 'media', 'all');
		this.electronService.ipcRenderer.send('app_is_init');
		if (this.store.token && this.store.refreshToken) {
			this.tokenRefreshService.start();
		}
	}

	ngOnDestroy(): void {
		this.electronService.ipcRenderer.removeListener('server_ping', this.handleServerPing.bind(this));
		this.electronService.ipcRenderer.removeListener('server_ping_restart', this.handleRestart.bind(this));
		this.electronService.ipcRenderer.removeListener('social_auth_success', this.handleSocialAuthSuccess.bind(this));
		this.electronService.ipcRenderer.removeListener(
			'social_auth_workspaces',
			this.handleSocialAuthWorkspaces.bind(this)
		);
		this.electronService.ipcRenderer.removeListener('__logout__', this.handleLogout.bind(this));
		this.electronService.ipcRenderer.removeListener('__auth__', this.handleAuthSuccess.bind(this));
		if (this.pingHostInterval) {
			clearInterval(this.pingHostInterval);
		}
	}

	handleServerPing(event: any, arg: any) {
		this._ngZone.run(() => {
			this.pingHostInterval = setInterval(async () => {
				try {
					await this.appService.pingServer(arg);
					console.log('Server Found');
					event.sender.send('server_is_ready');
					clearInterval(this.pingHostInterval);
					this.pingHostInterval = null;
				} catch (error) {
					console.log('ping status result', error.status);
					if (this.store.userId) {
						event.sender.send('server_is_ready');
						clearInterval(this.pingHostInterval);
						this.pingHostInterval = null;
					}
				}
			}, 1000);
		});
	}

	handleRestart(event: any, arg: any) {
		this._ngZone.run(() => {
			this.pingHostInterval = setInterval(async () => {
				try {
					await this.appService.pingServer(arg);
					console.log('Server Found');
					event.sender.send('server_already_start');
					clearInterval(this.pingHostInterval);
					this.pingHostInterval = null;
				} catch (error) {
					console.log('ping status result', error.status);
					if (this.store.userId) {
						event.sender.send('server_already_start');
						clearInterval(this.pingHostInterval);
						this.pingHostInterval = null;
					}
				}
			}, 3000);
		});
	}

	handleLogout(_: unknown, arg: any) {
		this._ngZone.run(async () => {
			try {
				// Stop proactive token refresh before logout
				this.tokenRefreshService.stop();
				await firstValueFrom(this.authStrategy.logout());
				this.electronService.ipcRenderer.send('navigate_to_login');
				if (arg) this.electronService.ipcRenderer.send('restart_and_update');
			} catch (error) {
				console.log('ERROR', error);
			}
		});
	}

	handleAuthSuccess(_: unknown, arg: any) {
		this._ngZone.run(async () => {
			try {
				this.store.userId = arg.userId;
				this.store.token = arg.token;
				this.store.organizationId = arg.organizationId;
				this.store.tenantId = arg.tenantId;
				this.store.user = arg.user;

				// Start token refresh timer on authentication
				if (arg.token && this.store.refreshToken) {
					this.tokenRefreshService.start();
				}
			} catch (error) {}
		});
	}

	handleSocialAuthSuccess(_: unknown, arg: any) {
		this._ngZone.run(async () => {
			try {
				this.store.userId = arg.userId;
				this.store.token = arg.token;
				await this.authFromSocial(arg);
			} catch (error) {
				console.log('ERROR', error);
			}
		});
	}

	/**
	 * A provider sign-in for an address with several workspaces ends at the workspace picker, with a one-time sign-in
	 * code instead of a token: the picker the e-mail code sign-in uses confirms the code, lists the workspaces and signs
	 * in to the one chosen (`AUTH_SUCCESS`). The code goes in the navigation state, never in the URL.
	 */
	handleSocialAuthWorkspaces(_: unknown, arg: { email?: string; code?: string }) {
		this._ngZone.run(async () => {
			if (!arg?.email || !arg?.code) {
				return;
			}
			try {
				await this.router.navigate(['/auth/magic-sign-in'], {
					state: { email: arg.email, code: arg.code }
				});
			} catch (error) {
				console.log('ERROR', error);
			}
		});
	}

	ngAfterViewInit(): void {
		this.languageElectronService.initialize();
		this.electronService.ipcRenderer.on('server_ping', this.handleServerPing.bind(this));
		this.electronService.ipcRenderer.on('server_ping_restart', this.handleRestart.bind(this));
		this.electronService.ipcRenderer.on('__logout__', this.handleLogout.bind(this));
		this.electronService.ipcRenderer.on('social_auth_success', this.handleSocialAuthSuccess.bind(this));
		this.electronService.ipcRenderer.on('social_auth_workspaces', this.handleSocialAuthWorkspaces.bind(this));
		this.electronService.ipcRenderer.on('__auth__', this.handleAuthSuccess.bind(this));
	}

	async authFromSocial(arg) {
		const jwtParsed: any = await this.jwtDecode(arg.token);
		if (jwtParsed) {
			if (jwtParsed.employeeId) {
				const user: IUser = await this.appService.getUserDetail();
				// Finished as the password and e-mail code sign-ins are. The agent's main process listens for
				// `AUTH_SUCCESS` (never `auth_success`, which only the timer handles): it saves the account, starts
				// tracking and closes the sign-in window.
				const response = await this.providerSession(user, arg.token);

				// Start token refresh timer after social auth
				if (arg.token && this.store.refreshToken) {
					this.tokenRefreshService.start();
				}

				const signedIn = this.authService.electronAuthentication(response);
				if (signedIn) {
					await firstValueFrom(signedIn);
				}
			} else {
				this.toastrService.show('Your account is not an employee', `Warning`, {
					status: 'danger'
				});
			}
		}
	}

	/**
	 * The session a provider sign-in starts. The provider's redirect brings an access token only, and a desktop session
	 * is a token pair: `Store.isAuthenticated$`, which the dashboard's `authGuard` reads, needs the refresh token too, as
	 * does the token refresh. The pair is asked for the workspace the token names, the caller's own account
	 * (`POST /auth/switch-workspace`): the pair a password sign-in gets. The employee comes with the pair: for a user
	 * employed in several organizations it is the one the tokens name, which `/user/me` need not have returned. Should
	 * that fail, the sign-in goes on with the access token alone.
	 *
	 * @param user The signed-in user, with the employee.
	 * @param token The access token the provider sign-in brought.
	 */
	private async providerSession(user: IUser, token: string): Promise<IAuthResponse> {
		const tokenOnly: IAuthResponse = { user, token };
		// Stored first: the request below carries this token, workspace and organization
		this.authStrategy.storeAuthenticationData(tokenOnly);
		try {
			const pair = await firstValueFrom(this.authService.switchWorkspace(user.tenantId));
			if (pair?.token && pair?.refresh_token) {
				const sessionUser: IUser = pair.user?.employee ? { ...user, employee: pair.user.employee } : user;
				const response: IAuthResponse = {
					user: sessionUser,
					token: pair.token,
					refresh_token: pair.refresh_token
				};
				this.authStrategy.storeAuthenticationData(response);
				return response;
			}
		} catch (error) {
			console.warn('No refresh token for the provider sign-in; going on with the access token alone', error);
		}
		return tokenOnly;
	}

	async jwtDecode(token) {
		try {
			return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
		} catch (e) {
			return null;
		}
	}

	loginStyleOverride() {
		const hashPage = location.hash;
		this.isLoginPage = hashPage.includes('auth');
	}

	setupHeighStyleOverride() {
		this.isSetupPage = location.hash.startsWith('#/setup');
	}

	async checkAuthValidation() {
		const hashPage = location.hash;
		if (hashPage.includes('auth')) {
			try {
				const mainAuth = await this.electronService.ipcRenderer.invoke('CHECK_MAIN_AUTH');
				if (!mainAuth?.token) {
					await firstValueFrom(this.authStrategy.logout());
				}
			} catch (error) {
				console.error('Failed to check main auth:', error);
			}
		}
	}
}
