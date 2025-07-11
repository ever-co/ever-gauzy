import {
	AfterViewInit,
	Component,
	NgZone,
	OnInit,
	Renderer2,
	HostBinding,
	OnDestroy
} from '@angular/core';
import { NbToastrService } from '@nebular/theme';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import {
	ActivityWatchElectronService,
	AuthStrategy,
	ElectronService,
	LanguageElectronService,
	Store,
	TimeTrackerDateManager
} from '@gauzy/desktop-ui-lib';
import { AppService } from './app.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'agent-root',
	template: '<router-outlet></router-outlet>',
	styleUrls: ['./app.component.scss'],
	standalone: false
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
	@HostBinding('class.login-small-height') isLoginPage = false;
	@HostBinding('class.setup-max-height') isSetupPage = false;
	private pingHostInterval: NodeJS.Timeout

	constructor(
		private electronService: ElectronService,
		private appService: AppService,
		private authStrategy: AuthStrategy,
		public readonly translate: TranslateService,
		private store: Store,
		private toastrService: NbToastrService,
		private _ngZone: NgZone,
		private _renderer: Renderer2,
		readonly activityWatchElectronService: ActivityWatchElectronService,
		readonly languageElectronService: LanguageElectronService
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
	}

	ngOnDestroy(): void {
		this.electronService.ipcRenderer.removeListener('server_ping', this.handleServerPing.bind(this));
		this.electronService.ipcRenderer.removeListener('server_ping_restart', this.handleRestart.bind(this));
		this.electronService.ipcRenderer.removeListener('social_auth_success', this.handleSocialAuthSuccess.bind(this));
		this.electronService.ipcRenderer.removeListener('__logout__', this.handleLogout.bind(this));
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
		})
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
		})
	}

	handleLogout(_: unknown, arg: any) {
		this._ngZone.run(async () => {
			try {
				await firstValueFrom(this.authStrategy.logout());
				this.electronService.ipcRenderer.send('navigate_to_login');
				if (arg) this.electronService.ipcRenderer.send('restart_and_update');
			} catch (error) {
				console.log('ERROR', error);
			}
		})
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
		})
	}

	ngAfterViewInit(): void {
		this.languageElectronService.initialize();
		this.electronService.ipcRenderer.on('server_ping', this.handleServerPing.bind(this));
		this.electronService.ipcRenderer.on('server_ping_restart', this.handleRestart.bind(this));
		this.electronService.ipcRenderer.on('__logout__', this.handleLogout.bind(this));
		this.electronService.ipcRenderer.on('social_auth_success', this.handleSocialAuthSuccess.bind(this));
	}

	async authFromSocial(arg) {
		const jwtParsed: any = await this.jwtDecode(arg.token);
		if (jwtParsed) {
			if (jwtParsed.employeeId) {
				const user: any = await this.appService.getUserDetail();
				TimeTrackerDateManager.organization = user?.employee?.organization;
				this.store.organizationId = user?.employee?.organizationId;
				this.store.tenantId = jwtParsed.tenantId;
				this.store.user = user;
				this.electronService.ipcRenderer.send('auth_success', {
					user: user,
					token: arg.token,
					userId: arg.userId,
					employeeId: jwtParsed.employeeId,
					tenantId: jwtParsed.tenantId,
					organizationId: user?.employee?.organizationId
				});
			} else {
				this.toastrService.show('Your account is not an employee', `Warning`, {
					status: 'danger'
				});
			}
		}
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
			} catch(error) {
				console.error('Failed to check main auth:', error);
			}
		}
	}
}
