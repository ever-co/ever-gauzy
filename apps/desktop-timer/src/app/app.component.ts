import {
	Component,
	NgZone,
	OnInit,
	AfterViewInit,
	Renderer2,
} from '@angular/core';
import {
	ElectronService,
	Store,
	AuthStrategy,
	TimeTrackerDateManager,
	ActivityWatchElectronService
} from '@gauzy/desktop-ui-lib';
import { AppService } from './app.service';
import { TranslateService } from '@ngx-translate/core';
import { LanguagesEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbToastrService } from '@nebular/theme';
import * as _ from 'underscore';
import { firstValueFrom } from 'rxjs';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-root',
	template: '<router-outlet></router-outlet>',
	styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, AfterViewInit {
	constructor(
		private electronService: ElectronService,
		private appService: AppService,
		private authStrategy: AuthStrategy,
		public readonly translate: TranslateService,
		private store: Store,
		private toastrService: NbToastrService,
		private _ngZone: NgZone,
		private _renderer: Renderer2,
	    readonly activityWatchElectronService: ActivityWatchElectronService
	) {
		activityWatchElectronService.setupActivitiesCollection();
	}

	ngOnInit(): void {
		console.log('On Init');
		const nebularLinkMedia = document.querySelector('link[media="print"]');
		if (nebularLinkMedia)
			this._renderer.setAttribute(nebularLinkMedia, 'media', 'all');
		this.electronService.ipcRenderer.send('app_is_init');
		this.store.systemLanguages$
			.pipe(untilDestroyed(this))
			.subscribe((languages) => {
				//Returns the language code name from the browser, e.g. "en", "bg", "he", "ru"
				const browserLang = this.translate.getBrowserLang() as string;

				//Gets default enum languages, e.g. "en", "bg", "he", "ru"
				const defaultLanguages = Object.values(LanguagesEnum);

				//Gets system languages
				const systemLanguages: string[] = _.pluck(
					languages,
					'code'
				) as string[];
				systemLanguages.concat(defaultLanguages);

				//Sets the default language to use as a fallback, e.g. "en"
				this.translate.setDefaultLang(LanguagesEnum.ENGLISH);

				//Use browser language as a primary language, if not found then use system default language, e.g. "en"
				this.translate.use(
					systemLanguages.includes(browserLang)
						? browserLang
						: LanguagesEnum.ENGLISH
				);

				// this.translate.onLangChange.subscribe(() => {
				// 	this.loading = false;
				// });
			});
	}

	ngAfterViewInit(): void {
		this.electronService.ipcRenderer.on('server_ping', (event, arg) =>
			this._ngZone.run(() => {
				const pingHost = setInterval(async () => {
					try {
						await this.appService.pingServer(arg);
						console.log('Server Found');
						event.sender.send('server_is_ready');
						clearInterval(pingHost);
					} catch (error) {
						console.log('ping status result', error.status);
						if (this.store.userId) {
							event.sender.send('server_is_ready');
							clearInterval(pingHost);
						}
					}
				}, 1000);
			})
		);

		this.electronService.ipcRenderer.on(
			'server_ping_restart',
			(event, arg) =>
				this._ngZone.run(() => {
					const pingHost = setInterval(async() => {
						try {
							await this.appService.pingServer(arg);
							console.log('Server Found');
							event.sender.send('server_already_start');
							clearInterval(pingHost);
						} catch (error) {
							console.log('ping status result', error.status);
							if (this.store.userId) {
								event.sender.send('server_already_start');
								clearInterval(pingHost);
							}
						}
					}, 3000);
				})
		);

		this.electronService.ipcRenderer.on('logout_timer', (event, arg) =>
			this._ngZone.run(() => {
				console.log(event, arg);
			})
		);

		this.electronService.ipcRenderer.on('__logout__', (event, arg) =>
			this._ngZone.run(async () => {
				try {
					await firstValueFrom(this.authStrategy.logout());
					this.electronService.ipcRenderer.send('navigate_to_login');
					if (arg)
						this.electronService.ipcRenderer.send(
							'restart_and_update'
						);
				} catch (error) {
					console.log('ERROR', error);
				}
			})
		);

		this.electronService.ipcRenderer.on(
			'social_auth_success',
			(event, arg) =>
				this._ngZone.run(async () => {
					try {
						this.store.userId = arg.userId;
						this.store.token = arg.token;
						await this.authFromSocial(arg);
					} catch (error) {
						console.log('ERROR', error);
					}
				})
		);
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
					organizationId: user.employee
						? user.employee.organizationId
						: null,
				});
			} else {
				this.toastrService.show(
					'Your account is not an employee',
					`Warning`,
					{
						status: 'danger',
					}
				);
			}
		}
	}

	async jwtDecode(token) {
		try {
			return JSON.parse(
				Buffer.from(token.split('.')[1], 'base64').toString()
			);
		} catch (e) {
			return null;
		}
	}
}
