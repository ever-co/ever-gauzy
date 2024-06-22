import {
	Component,
	OnInit,
	ChangeDetectionStrategy,
	ViewChild,
	ElementRef,
	NgZone,
	AfterViewInit,
	Optional,
	Inject
} from '@angular/core';
import { TimeTrackerService } from '../time-tracker/time-tracker.service';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { ElectronService } from '../electron/services';
import { BehaviorSubject, Observable, filter, tap, firstValueFrom, from } from 'rxjs';
import { AboutComponent } from '../dialogs/about/about.component';
import { SetupService } from '../setup/setup.service';
import * as moment from 'moment';
import { TimeTrackerDateManager, TimeZoneManager, ToastrNotificationService, ZoneEnum } from '../services';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { AuthStrategy } from '../auth';
import { DEFAULT_SCREENSHOT_FREQUENCY_OPTIONS, LanguagesEnum } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { LanguageSelectorService } from '../language/language-selector.service';
import { GAUZY_ENV } from '../constants';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-settings',
	templateUrl: './settings.component.html',
	styleUrls: ['./settings.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: [
		`
			:host nb-tab {
				padding: 1rem;
			}
		`
	]
})
export class SettingsComponent implements OnInit, AfterViewInit {
	@ViewChild('selectRef') selectProjectElement: ElementRef;
	@ViewChild('logBox', { read: ElementRef })
	set logBox(content: ElementRef) {
		if (content) {
			this._logBox = content;
		}
	}
	@ViewChild('logUpdate') logAccordion;
	private _logBox: ElementRef;
	private _logContents$: BehaviorSubject<any[]> = new BehaviorSubject([]);
	public get logContents$(): Observable<any[]> {
		return this._logContents$.asObservable();
	}
	public set logContents(value: any) {
		const logs = this._logContents$.getValue();
		logs.push(value);
		this._logContents$.next(logs);
	}
	logIsOpen = false;
	private _isRestart$: BehaviorSubject<boolean>;

	appName: string = this.electronService.remote.app.getName();
	menus = [];
	gauzyIcon: SafeResourceUrl =
		this.isDesktopTimer || this.isServer
			? './assets/images/logos/logo_i4net.png'
			: '../assets/images/logos/logo_i4net.png';

	private _monitorsOption$: BehaviorSubject<any> = new BehaviorSubject([
		{
			value: 'all',
			title: 'TIMER_TRACKER.SETTINGS.CAPTURE_ALL_MONITORS',
			subtitle: 'TIMER_TRACKER.SETTINGS.ALL_CONNECTED_MONITORS',
			accent: 'basic',
			status: 'basic'
		},
		{
			value: 'active-only',
			title: 'TIMER_TRACKER.SETTINGS.CAPTURE_ACTIVE_MONITOR',
			subtitle: 'TIMER_TRACKER.SETTINGS.MONITOR_CURRENT_POSITION',
			iconStyle: 'all-monitor_icon',
			accent: 'basic',
			status: 'basic'
		}
	]);
	thirdPartyConfig = [
		{
			title: 'Unleash',
			fields: [
				{
					name: 'UNLEASH_APP_NAME',
					field: 'UNLEASH_APP_NAME',
					value: ''
				},
				{
					name: 'UNLEASH_API_URL',
					field: 'UNLEASH_API_URL',
					value: ''
				},
				{
					name: 'UNLEASH_INSTANCE_ID',
					field: 'UNLEASH_INSTANCE_ID',
					value: ''
				},
				{
					name: 'UNLEASH_REFRESH_INTERVAL',
					field: 'UNLEASH_REFRESH_INTERVAL',
					value: 15000
				},
				{
					name: 'UNLEASH_METRICS_INTERVAL',
					field: 'UNLEASH_METRICS_INTERVAL',
					value: 60000
				},
				{
					name: 'UNLEASH_API_KEY',
					field: 'UNLEASH_API_KEY',
					value: ''
				}
			]
		},
		{
			title: 'Twitter',
			fields: [
				{
					name: 'TWITTER_CLIENT_ID',
					field: 'TWITTER_CLIENT_ID',
					value: ''
				},
				{
					name: 'TWITTER_CLIENT_SECRET',
					field: 'TWITTER_CLIENT_SECRET',
					value: ''
				},
				{
					name: 'TWITTER_CALLBACK_URL',
					field: 'TWITTER_CALLBACK_URL',
					value: 'http://localhost:3800/api/auth/twitter/callback'
				}
			]
		},
		{
			title: 'Google',
			fields: [
				{
					name: 'GOOGLE_CLIENT_ID',
					field: 'GOOGLE_CLIENT_ID',
					value: ''
				},
				{
					name: 'GOOGLE_CLIENT_SECRET',
					field: 'GOOGLE_CLIENT_SECRET',
					value: ''
				},
				{
					name: 'GOOGLE_CALLBACK_URL',
					field: 'GOOGLE_CALLBACK_URL',
					value: 'http://localhost:3800/api/auth/google/callback'
				}
			]
		},
		{
			title: 'Facebook',
			fields: [
				{
					name: 'FACEBOOK_CLIENT_ID',
					field: 'FACEBOOK_CLIENT_ID',
					value: ''
				},
				{
					name: 'FACEBOOK_CLIENT_SECRET',
					field: 'FACEBOOK_CLIENT_SECRET',
					value: ''
				},
				{
					name: 'FACEBOOK_CALLBACK_URL',
					field: 'FACEBOOK_CALLBACK_URL',
					value: ''
				},
				{
					name: 'FACEBOOK_GRAPH_VERSION',
					field: 'FACEBOOK_GRAPH_VERSION',
					value: ''
				}
			]
		},
		{
			title: 'Github',
			fields: [
				{
					name: 'I4NET_GITHUB_OAUTH_CLIENT_ID',
					field: 'I4NET_GITHUB_OAUTH_CLIENT_ID',
					value: ''
				},
				{
					name: 'I4NET_GITHUB_OAUTH_CLIENT_SECRET',
					field: 'I4NET_GITHUB_OAUTH_CLIENT_SECRET',
					value: ''
				},
				{
					name: 'I4NET_GITHUB_OAUTH_CALLBACK_URL',
					field: 'I4NET_GITHUB_OAUTH_CALLBACK_URL',
					value: ''
				}
			]
		},
		{
			title: 'LinkedIn',
			fields: [
				{
					name: 'LINKEDIN_CLIENT_ID',
					field: 'LINKEDIN_CLIENT_ID',
					value: ''
				},
				{
					name: 'LINKEDIN_CLIENT_SECRET',
					field: 'LINKEDIN_CLIENT_SECRET',
					value: ''
				},
				{
					name: 'LINKEDIN_CALLBACK_URL',
					field: 'LINKEDIN_CALLBACK_URL',
					value: ''
				}
			]
		},
		{
			title: 'Microsoft',
			fields: [
				{
					name: 'MICROSOFT_CLIENT_ID',
					field: 'MICROSOFT_CLIENT_ID',
					value: ''
				},
				{
					name: 'MICROSOFT_CLIENT_SECRET',
					field: 'MICROSOFT_CLIENT_SECRET',
					value: ''
				},
				{
					name: 'MICROSOFT_RESOURCE',
					field: 'MICROSOFT_RESOURCE',
					value: ''
				},
				{
					name: 'MICROSOFT_TENANT',
					field: 'MICROSOFT_TENANT',
					value: ''
				},
				{
					name: 'MICROSOFT_CALLBACK_URL',
					field: 'MICROSOFT_CALLBACK_URL',
					value: ''
				}
			]
		},
		{
			title: 'Fiverr',
			fields: [
				{
					name: 'FIVERR_CLIENT_ID',
					field: 'FIVERR_CLIENT_ID',
					value: ''
				},
				{
					name: 'FIVERR_CLIENT_SECRET',
					field: 'FIVERR_CLIENT_SECRET',
					value: ''
				}
			]
		},
		{
			title: 'Auth0',
			fields: [
				{
					name: 'AUTH0_CLIENT_ID',
					field: 'AUTH0_CLIENT_ID',
					value: ''
				},
				{
					name: 'AUTH0_CLIENT_SECRET',
					field: 'AUTH0_CLIENT_SECRET',
					value: ''
				},
				{
					name: 'AUTH0_DOMAIN',
					field: 'AUTH0_DOMAIN',
					value: ''
				}
			]
		},
		{
			title: 'Keycloak',
			fields: [
				{
					name: 'KEYCLOAK_REALM',
					field: 'KEYCLOAK_REALM',
					value: ''
				},
				{
					name: 'KEYCLOAK_CLIENT_ID',
					field: 'KEYCLOAK_CLIENT_ID',
					value: ''
				},
				{
					name: 'KEYCLOAK_SECRET',
					field: 'KEYCLOAK_SECRET',
					value: ''
				},
				{
					name: 'KEYCLOAK_AUTH_SERVER_URL',
					field: 'KEYCLOAK_AUTH_SERVER_URL',
					value: ''
				},
				{
					name: 'KEYCLOAK_COOKIE_KEY',
					field: 'KEYCLOAK_COOKIE_KEY',
					value: ''
				}
			]
		},
		{
			title: 'Other',
			fields: [
				{
					name: 'SENTRY_DSN',
					field: 'SENTRY_DSN',
					value: ''
				},
				{
					name: 'GOOGLE_MAPS_API_KEY',
					field: 'GOOGLE_MAPS_API_KEY',
					value: ''
				}
			]
		}
	];

	private _selectedMenu$: BehaviorSubject<string>;
	private get _selectedMenu(): string {
		return this._selectedMenu$.getValue();
	}
	/* Set Default Value */
	appSetting = {
		timerStarted: false,
		randomScreenshotTime: 10,
		trackOnPcSleep: false,
		preventDisplaySleep: false,
		visibleAwOption: true,
		visibleWakatimeOption: false,
		preferredLanguage: LanguagesEnum.ENGLISH,
		enforced: false
	};
	periodOption = DEFAULT_SCREENSHOT_FREQUENCY_OPTIONS;
	selectedPeriod = 5;
	screenshotNotification = null;
	config = {
		/* Default Selected dialect	*/
		db: 'better-sqlite',
		/* Default Mysql config */
		mysql: {
			dbHost: '127.0.0.1',
			dbPort: 3306,
			dbUsername: 'root',
			dbPassword: ''
		},
		/* Default PostgresSQL config */
		postgres: {
			dbHost: '127.0.0.1',
			dbPort: 5432,
			dbUsername: 'postgres',
			dbPassword: 'postgres'
		},
		timeTrackerWindow: null,
		isLocalServer: false,
		serverType: null,
		serverUrl: null,
		awPort: null,
		awHost: null,
		port: 3800,
		portUi: 4200,
		host: '0.0.0.0',
		secureProxy: {
			ssl: {
				key: '',
				cert: ''
			},
			secure: true,
			enable: false
		},
		autoStart: true
	};
	version = '0.0.0';
	message = {
		text: 'TIMER_TRACKER.SETTINGS.MESSAGES.APP_UPDATE',
		status: 'basic'
	};
	downloadFinish = false;
	progressDownload = 0;
	showProgressBar = false;
	autoLaunch = null;
	minimizeOnStartup = null;
	authSetting = null;
	currentUser$: BehaviorSubject<any> = new BehaviorSubject(null);
	serverTypes = {
		integrated: 'Integrated',
		custom: 'Custom',
		live: 'Live'
	};
	waitRestart = false;
	serverIsRunning = false;

	serverOptions = this.isDesktopTimer
		? [this.serverTypes.custom, this.serverTypes.live]
		: [this.serverTypes.integrated, this.serverTypes.custom, this.serverTypes.live];

	driverOptions = ['better-sqlite', 'sqlite', 'postgres', ...(this.isDesktopTimer ? ['mysql'] : [])];
	muted: boolean;

	delayOptions: number[] = [0.5, 1, 3, 24];
	zones = TimeZoneManager.zones;
	selectedZone: ZoneEnum = ZoneEnum.LOCAL;
	companyName: string;
	companyLink: string;
	companySite: string;

	private _loading$: BehaviorSubject<boolean>;
	private _automaticUpdate$: BehaviorSubject<boolean>;
	private _automaticUpdateDelay$: BehaviorSubject<number>;
	private _available$: BehaviorSubject<boolean>;
	private _updaterServer$: BehaviorSubject<any>;
	private _file$: BehaviorSubject<any>;
	private _prerelease$: BehaviorSubject<boolean>;
	private _isCheckDatabase$: BehaviorSubject<boolean>;
	private _isCheckHost$: BehaviorSubject<{
		isLoading: boolean;
		isHidden: boolean;
		message: string;
		status: boolean;
	}>;
	private _isConnectedDatabase$: BehaviorSubject<{
		status: boolean;
		message: string;
	}>;
	private _restartDisable$: BehaviorSubject<boolean>;
	private _isHidden$: BehaviorSubject<boolean>;
	private _simpleScreenshotNotification$: BehaviorSubject<boolean>;
	private _timeZoneManager = TimeZoneManager;

	constructor(
		private electronService: ElectronService,
		private _ngZone: NgZone,
		private readonly timeTrackerService: TimeTrackerService,
		private toastrService: NbToastrService,
		private _dialogService: NbDialogService,
		private _setupService: SetupService,
		private _notifier: ToastrNotificationService,
		private _translateService: TranslateService,
		private _languageSelectorService: LanguageSelectorService,
		@Optional()
		private _authStrategy: AuthStrategy,
		@Inject(GAUZY_ENV)
		private readonly _environment: any,
		private readonly _domSanitizer: DomSanitizer
	) {
		this._loading$ = new BehaviorSubject(false);
		this._automaticUpdate$ = new BehaviorSubject(false);
		this._automaticUpdateDelay$ = new BehaviorSubject(1);
		this._available$ = new BehaviorSubject(false);
		this._file$ = new BehaviorSubject({ uri: null });
		this._updaterServer$ = new BehaviorSubject({
			github: false,
			digitalOcean: true,
			local: false
		});
		this._prerelease$ = new BehaviorSubject(false);
		this._selectedMenu$ = new BehaviorSubject(null);
		this._isCheckDatabase$ = new BehaviorSubject(false);
		this._isCheckHost$ = new BehaviorSubject({
			isLoading: false,
			isHidden: true,
			status: false,
			message: ''
		});
		this._isConnectedDatabase$ = new BehaviorSubject({
			status: false,
			message: null
		});
		this._restartDisable$ = new BehaviorSubject(false);
		this._isHidden$ = new BehaviorSubject(true);
		this._simpleScreenshotNotification$ = new BehaviorSubject(false);
		this._isRestart$ = new BehaviorSubject(false);
		this.companyName = this._environment.COMPANY_NAME;
		this.companySite = this._environment.COMPANY_SITE;
		this.companyLink = this._environment.COMPANY_LINK;
		this.gauzyIcon = this._domSanitizer.bypassSecurityTrustResourceUrl(
			this._environment.PLATFORM_LOGO
		);
	}

	ngOnInit(): void {
		this.electronService.ipcRenderer.send('request_permission');
		this.version = this.electronService.remote.app.getVersion();
		this.isConnectedDatabase$
			.pipe(
				tap(({ status }) => this._restartDisable$.next(!status)),
				filter(() => !this._isCheckHost.status),
				tap(() => this._restartDisable$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.isCheckHost$
			.pipe(
				tap(({ status }) => this._restartDisable$.next(!status)),
				filter(() => !this._isConnectedDatabase.status),
				tap(() => this._restartDisable$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.isRestart$
			.pipe(
				tap((isRestart: boolean) =>
					this._restartDisable$.next(isRestart)
				),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this.electronService.ipcRenderer.on('app_setting', (event, arg) =>
			this._ngZone.run(async () => {
				const { setting, config, auth, additionalSetting } = arg;
				this.appSetting = {
					...this.appSetting,
					...setting
				};
				this.config = {
					...this.config,
					...config
				};
				this.checkDatabaseConnectivity();
				this.authSetting = auth;
				this.mappingAdditionalSetting(additionalSetting || null);
				this.selectedZone = setting?.zone || ZoneEnum.LOCAL;
				this._timeZoneManager.changeZone(this.selectedZone);
				if (!this.isServer && !this.config?.isLocalServer) {
					await this.checkHostConnectivity();
				} else {
					this._isCheckHost$.next({
						...this._isCheckHost,
						status: true
					});
				}
				this.config.awPort = this.config.timeTrackerWindow ? this.config.awHost.split('t:')[1] : null;
				this.serverConnectivity();
				this._monitorsOption = { value: setting?.monitor?.captured };
				this.screenshotNotification = setting?.screenshotNotification;
				this.muted = setting?.mutedNotification;
				this.autoLaunch = setting?.autoLaunch;
				this.minimizeOnStartup = setting?.minimizeOnStartup;
				this._automaticUpdate$.next(setting?.automaticUpdate);
				this._automaticUpdateDelay$.next(setting?.automaticUpdateDelay);
				this._prerelease$.next(setting?.prerelease);
				this._updaterServer$ = new BehaviorSubject({
					github: setting?.cdnUpdater?.github == true,
					digitalOcean: setting?.cdnUpdater?.digitalOcean == true,
					local: false
				});
				this._simpleScreenshotNotification$.next(setting?.simpleScreenshotNotification);
				this.selectedPeriod = setting?.timer?.updatePeriod;
				if (this.isDesktopTimer) {
					await this.getUserDetails();
				}
				this.menus = this.isServer
					? ['TIMER_TRACKER.SETTINGS.UPDATE', 'TIMER_TRACKER.SETTINGS.ADVANCED_SETTINGS', 'MENU.ABOUT']
					: [
						...(auth && auth.allowScreenshotCapture ? ['TIMER_TRACKER.SETTINGS.SCREEN_CAPTURE'] : []),
						'TIMER_TRACKER.TIMER',
						'TIMER_TRACKER.SETTINGS.UPDATE',
						'TIMER_TRACKER.SETTINGS.ADVANCED_SETTINGS',
						'MENU.ABOUT'
					];
				const lastMenu =
					this._selectedMenu && this.menus.includes(this._selectedMenu) ? this._selectedMenu : this.menus[0];
				this._selectedMenu$.next(lastMenu);
			})
		);

		this.electronService.ipcRenderer.on('app_setting_update', (event, arg) =>
			this._ngZone.run(() => {
				const { setting } = arg;
				this.appSetting = setting;
			})
		);

		this.electronService.ipcRenderer.on('update_not_available', () =>
			this._ngZone.run(() => {
				this._available$.next(false);
				this.message = {
					text: 'TIMER_TRACKER.SETTINGS.MESSAGES.UPDATE_NOT_AVAILABLE',
					status: 'basic'
				};
				this.logContents = this._translateService.instant(this.message.text);
				this.scrollToBottom();
				this._loading$.next(false);
			})
		);

		this.electronService.ipcRenderer.on('error_update', (event, arg) =>
			this._ngZone.run(() => {
				this._available$.next(false);
				this.message = {
					text: 'TIMER_TRACKER.SETTINGS.MESSAGES.UPDATE_ERROR',
					status: 'danger'
				};
				this.logContents = this._translateService.instant(this.message.text);
				this.logContents = `error message: ${arg}`;
				this.scrollToBottom();
				this._loading$.next(false);
			})
		);

		this.electronService.ipcRenderer.on('update_available', () =>
			this._ngZone.run(() => {
				this._available$.next(true);
				this._loading$.next(false);
				this.message = {
					text: 'TIMER_TRACKER.SETTINGS.MESSAGES.UPDATE_AVAILABLE',
					status: 'primary'
				};
				this.logContents = this._translateService.instant(this.message.text);
				this.scrollToBottom();
			})
		);

		this.electronService.ipcRenderer.on('update_downloaded', () =>
			this._ngZone.run(() => {
				this._available$.next(true);
				this.message = {
					text: 'TIMER_TRACKER.SETTINGS.MESSAGES.UPDATE_DOWNLOAD_COMPLETED',
					status: 'success'
				};
				this.logContents = this._translateService.instant(this.message.text);
				this.scrollToBottom();
				this.showProgressBar = false;
				this.downloadFinish = true;
				this._loading$.next(false);
			})
		);

		this.electronService.ipcRenderer.on('download_on_progress', (event, arg) =>
			this._ngZone.run(() => {
				this._loading$.next(true);
				this._available$.next(true);
				this.showProgressBar = true;
				this.message = {
					text: 'TIMER_TRACKER.SETTINGS.MESSAGES.UPDATE_DOWNLOADING',
					status: 'warning'
				};
				this.progressDownload = Math.floor(Number(arg.percent));
				this.logContents = this._translateService.instant(
					'TIMER_TRACKER.SETTINGS.MESSAGES.DOWNLOADING_UPDATE',
					{
						current: Math.floor(arg.transferred / 1000000),
						total: Math.floor(arg.total / 1000000),
						bandwidth: Math.floor(arg.bytesPerSecond / 1000),
					}
				);
				this.scrollToBottom();
			})
		);

		this.electronService.ipcRenderer.on('goto_update', () =>
			this._ngZone.run(() => {
				this.selectMenu('TIMER_TRACKER.SETTINGS.UPDATE');
			})
		);

		this.electronService.ipcRenderer.on('goto_top_menu', () =>
			this._ngZone.run(() => {
				const lastMenu =
					this._selectedMenu && this.menus.includes(this._selectedMenu) ? this._selectedMenu : this.menus[0];
				this.selectMenu(lastMenu);
			})
		);

		this.electronService.ipcRenderer.on('goto_advanced_setting', () => {
			this.selectMenu('TIMER_TRACKER.SETTINGS.ADVANCED_SETTINGS');
		});

		this.electronService.ipcRenderer.on('logout_success', () =>
			this._ngZone.run(() => {
				this.currentUser$.next(null);
			})
		);

		this.electronService.ipcRenderer.on('resp_msg', (event, arg) =>
			this._ngZone.run(() => {
				this.showAlert(arg);
			})
		);

		this.electronService.ipcRenderer.on('server_status', (event, arg) =>
			this._ngZone.run(() => {
				this.serverIsRunning = arg;
			})
		);

		this.electronService.ipcRenderer.on('update_files_directory', (event, arg) => {
			this._ngZone.run(() => {
				this._file$.next(arg);
			});
		});

		this.electronService.ipcRenderer.on('show_about', () => {
			this._ngZone.run(() => {
				this._dialogService.open(AboutComponent);
			});
		});

		this.electronService.ipcRenderer.on('database_status', (event, arg) => {
			this._ngZone.run(() => {
				this._isCheckDatabase$.next(false);
				this._isConnectedDatabase$.next(arg);
				this._isHidden$.next(false);
			});
		});

		this.electronService.ipcRenderer.on('_logout_quit_install_', (event, arg) => {
			this._ngZone.run(async () => {
				await this.restartAndUpdate();
			});
		});

		this.electronService.ipcRenderer.on(
			'preferred_language_change',
			(event, language: LanguagesEnum) => {
				this._ngZone.run(() => {
					this._languageSelectorService.setLanguage(
						language,
						this._translateService
					);
					TimeTrackerDateManager.locale(language);
				});
			}
		);

		from(this.electronService.ipcRenderer.invoke('PREFERRED_LANGUAGE'))
			.pipe(
				tap((language: LanguagesEnum) => {
					this._languageSelectorService.setLanguage(
						language,
						this._translateService
					);
					TimeTrackerDateManager.locale(language);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	mappingAdditionalSetting(values) {
		if (values) {
			this.thirdPartyConfig.forEach((item) => {
				item.fields.forEach((itemField) => {
					itemField.value = values[itemField.field];
				});
			});
		}
	}

	selectMonitorOption(item) {
		this._monitorsOption = item;
		this.updateSetting({ captured: item?.value }, 'monitor');
	}

	private set _monitorsOption(item) {
		this._monitorsOption$.next(
			this._monitorsOption.map((x) => {
				if (x.value === item?.value) {
					x.accent = 'primary';
					x.status = 'primary';
				} else {
					x.accent = 'basic';
					x.status = 'basic';
				}
				return x;
			})
		);
	}

	selectMenu(menu) {
		this._selectedMenu$.next(menu);
	}

	updateSetting(value, type: string, showNotification = true) {
		this.appSetting[type] = value;
		this.electronService.ipcRenderer.send('update_app_setting', {
			values: this.appSetting
		});
		if (showNotification) {
			this._notifier.success(
				'Update ' + type.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase() + ' setting successfully'
			);
		}
	}

	selectPeriod(value) {
		this.selectedPeriod = value;
		this.updateSetting({ updatePeriod: value }, 'timer');
	}

	selectZone(value: ZoneEnum) {
		this._timeZoneManager.changeZone(value);
		this.updateSetting(value, 'zone');
		this.electronService.ipcRenderer.send('refresh-timer');
	}

	toggleNotificationChange(value) {
		const isUpdateTwice = value && this.simpleScreenshotNotification;
		this.updateSetting(value, 'screenshotNotification', !isUpdateTwice);
		this.screenshotNotification = value;
		if (isUpdateTwice) {
			this.updateSetting(false, 'simpleScreenshotNotification');
			this._simpleScreenshotNotification$.next(false);
		}
	}

	toggleSimpleNotificationChange(value) {
		const isUpdateTwice = value && this.screenshotNotification;
		this.updateSetting(value, 'simpleScreenshotNotification', !isUpdateTwice);
		this._simpleScreenshotNotification$.next(value);
		if (isUpdateTwice) {
			this.updateSetting(false, 'screenshotNotification');
			this.screenshotNotification = false;
		}
	}

	toggleNotificationSoundChange(value: boolean) {
		this.updateSetting(!value, 'mutedNotification');
		this.muted = !value;
	}

	toggleAutoLaunch(value) {
		this.updateSetting(value, 'autoLaunch');
		this.electronService.ipcRenderer.send('launch_on_startup', {
			autoLaunch: value,
			hidden: this.minimizeOnStartup
		});
	}

	toggleMinimizeOnStartup(value) {
		this.updateSetting(value, 'minimizeOnStartup');
		this.electronService.ipcRenderer.send('minimize_on_startup', {
			autoLaunch: this.autoLaunch,
			hidden: value
		});
	}

	toggleAutoStartOnStartup(value: boolean) {
		this.updateServerConfig(value, 'autoStart');
	}

	toggleAutomaticUpdate(value) {
		this._automaticUpdate$.next(value);
		this.updateSetting(value, 'automaticUpdate');
		this.electronService.ipcRenderer.send('automatic_update_setting', {
			isEnabled: value,
			delay: this._automaticUpdateDelay$.getValue()
		});
	}

	selectAutomaticUpdateDelay(value) {
		this._automaticUpdateDelay$.next(value);
		this.updateSetting(value, 'automaticUpdateDelay');
		this.electronService.ipcRenderer.send('automatic_update_setting', {
			isEnabled: this._automaticUpdate$.getValue(),
			delay: value
		});
	}

	togglePrerelease(value) {
		this._prerelease$.next(value);
		this.updateSetting(value, 'prerelease');
	}

	toggleAlwaysOn(value: boolean) {
		this.updateSetting(value, 'alwaysOn');
		this.electronService.ipcRenderer.send(value ? 'show_ao' : 'hide_ao');
	}

	public async restartApp(): Promise<void> {
		this._isRestart$.next(true);
		if (!this.isServer && !this.authSetting.isLogout) {
			await firstValueFrom(this._authStrategy.logout());
			this.currentUser$.next(null);
			localStorage.clear();
		}
		const thConfig = {};
		this.thirdPartyConfig.forEach((item) => {
			item.fields.forEach((itemField) => {
				thConfig[itemField.field] = itemField.value;
			});
		});
		const newConfig: any = {
			...this.config
		};
		if (this.config.timeTrackerWindow) newConfig.awHost = `http://127.0.0.1:${this.config.awPort}`;
		this.electronService.ipcRenderer.send('restart_app', newConfig);
		this.electronService.ipcRenderer.send('save_additional_setting', thConfig);
	}

	portChange(val, type) {
		if (type === 'api') {
			if (['5621', '5622'].findIndex((item) => item === val.toString()) > -1) {
				this._restartDisable$.next(true);
			} else {
				this._restartDisable$.next(false);
			}
		}
		if (type === 'db') {
			console.log('Port change', val);
			this._restartDisable$.next(true);
			this._isHidden$.next(true);
		}
	}

	serverConnectivity() {
		switch (true) {
			case this.config.isLocalServer:
				this.config.serverType = 'Integrated';
				break;
			case !this.config.isLocalServer && this.config.serverUrl !== 'https://api.i4net.co.il':
				this.config.serverType = 'Custom';
				break;
			case !this.config.isLocalServer && this.config.serverUrl === 'https://api.i4net.co.il':
				this.config.serverType = 'Live';
				break;
			default:
				break;
		}
	}

	public checkDatabaseConnectivity() {
		this._isHidden$.next(false);
		this._restartDisable$.next(true);
		this._isCheckDatabase$.next(true);
		this.electronService.ipcRenderer.send('check_database_connection', this.config);
	}

	checkForUpdate() {
		this._loading$.next(true);
		this.logIsOpen = true;
		this.electronService.ipcRenderer.send('check_for_update');
	}

	public async restartAndUpdate(): Promise<void> {
		await this.logout(true);
	}

	toggleAwView(value) {
		this.updateSetting(value, 'visibleAwOption');
		this.electronService.ipcRenderer.send('switch_aw_option', value);
	}

	toggleRandomScreenshot(value) {
		this.updateSetting(value, 'randomScreenshotTime');
	}

	toggleWakatimeView(value) {
		this.updateSetting(value, 'visibleWakatimeOption');
		this.electronService.ipcRenderer.send('switch_aw_option', value);
	}

	toggleTrackOnPcSleep(value) {
		this.updateSetting(value, 'trackOnPcSleep');
	}

	/*
	 * Get logged in user details
	 */
	public async getUserDetails() {
		if (this.authSetting) {
			try {
				if (this.authSetting.isLogout) {
					this.currentUser$.next(null);
					return;
				}
				const user = await this.timeTrackerService.getUserDetail();
				this.currentUser$.next(user);
			} catch (error) {
				console.log('User Detail error', error);
			}
		} else {
			this.currentUser$.next(null);
		}
	}

	/*
	 * Logout desktop timer
	 */
	public async logout(isAfterUpgrade?: boolean): Promise<void> {
		let isLogout = true;

		if (this.appSetting?.timerStarted) {
			isLogout = await this.electronService.ipcRenderer.invoke(
				'LOGOUT_STOP'
			);
		} else {
			localStorage.clear();
		}

		if (isLogout) {
			console.log('On Logout');
			this.electronService.ipcRenderer.send(
				'logout_desktop',
				isAfterUpgrade
			);
		} else {
			console.log('Logout Cancelled');
		}
	}

	onServerChange(val) {
		this._restartDisable$.next(true);
		switch (val) {
			case this.serverTypes.integrated:
				this.config.isLocalServer = true;
				this.config.port = 3800;
				this.config.serverUrl = null;
				break;
			case this.serverTypes.custom:
				this.config.isLocalServer = false;
				this.config.serverUrl = 'http://127.0.0.1:3800';
				break;
			case this.serverTypes.live:
				this.config.isLocalServer = false;
				this.config.serverUrl = 'https://api.i4net.co.il';
				break;
			default:
				break;
		}
	}

	onDriverChange(val) {
		this._restartDisable$.next(true);
		this._isHidden$.next(true);
		switch (val) {
			case 'sqlite':
				this.config.db = 'sqlite';
				break;
			case 'postgres':
				this.config.db = 'postgres';
				break;
			case 'mysql':
				this.config.db = 'mysql';
				break;
			case 'better-sqlite':
				this.config.db = 'better-sqlite';
				break;
			default:
				break;
		}
	}

	showAlert(arg) {
		let message = '';
		switch (arg?.type) {
			case 'update_config':
				message = arg?.message ?? arg?.message ?? 'TIMER_TRACKER.SETTINGS.MESSAGES.SERVER_CONFIG_UPDATED';
				break;
			case 'start_server':
				this._restartDisable$.next(false);
				message = 'TIMER_TRACKER.SETTINGS.MESSAGES.SERVER_RESTARTED';
				break;
			default:
				break;
		}
		this.toastrService.show(this._translateService.instant(message), `Success`, { status: arg?.status });
		this._isRestart$.next(false);
	}

	logBoxChange(e) {
		if (e) {
			this.logIsOpen = false;
		} else {
			this.logIsOpen = true;
		}
	}

	private scrollToBottom() {
		if (this.logIsOpen && this._logBox) {
			this._logBox.nativeElement.scrollTop = this._logBox.nativeElement.scrollHeight;
		}
	}

	public togglePreventDisplaySleep(event: boolean): void {
		this.updateSetting(event, 'preventDisplaySleep');
	}

	public openLink() {
		const url = 'https://i4net.co.il';
		this.electronService.shell.openExternal(url);
	}

	public get loading$() {
		return this._loading$.asObservable();
	}

	public get available$() {
		return this._available$.asObservable();
	}

	public get automaticUpdate$(): Observable<boolean> {
		return this._automaticUpdate$.asObservable();
	}

	public get prerelease$(): Observable<boolean> {
		return this._prerelease$.asObservable();
	}

	public downloadNow() {
		this._loading$.next(true);
		this.logIsOpen = true;
		this.electronService.ipcRenderer.send('download_update');
	}

	public selectDirectory() {
		this.electronService.ipcRenderer.send('update_locally');
	}

	public get updaterServer$(): Observable<any> {
		return this._updaterServer$.asObservable();
	}

	public get file$(): Observable<any> {
		return this._file$.asObservable();
	}

	public toggleGithubDefaultServer(event: boolean) {
		this._updaterServer$.next({
			github: event,
			digitalOcean: !event,
			local: false
		});
		this.updateSetting(this._updaterServer$.getValue(), 'cdnUpdater');
		this.electronService.ipcRenderer.send('change_update_strategy', this._updaterServer$.getValue());
	}

	public toggleDigitalOceanDefaultServer(event: boolean) {
		this._updaterServer$.next({
			github: !event,
			digitalOcean: event,
			local: false
		});
		this.updateSetting(this._updaterServer$.getValue(), 'cdnUpdater');
		this.electronService.ipcRenderer.send('change_update_strategy', this._updaterServer$.getValue());
	}

	public toggleLocalServer(event: boolean) {
		this._file$.next({});
		this._updaterServer$.next({
			...this._updaterServer$.getValue(),
			local: event
		});
		this.electronService.ipcRenderer.send('change_update_strategy', this._updaterServer$.getValue());
	}

	public get isDesktopTimer(): boolean {
		return this._environment.IS_DESKTOP_TIMER;
	}

	public get isDesktop(): boolean {
		return this._environment.IS_DESKTOP;
	}

	public get isServer(): boolean {
		return this._environment.IS_SERVER;
	}

	public get isServerApi(): boolean {
		return this._environment.IS_SERVER_API;
	}

	public get selectedMenu$(): Observable<string> {
		return this._selectedMenu$.asObservable();
	}

	public get _isConnectedDatabase(): { status: boolean; message: string } {
		return this._isConnectedDatabase$.getValue();
	}

	public get isConnectedDatabase$(): Observable<{
		status: boolean;
		message: string;
	}> {
		return this._isConnectedDatabase$.asObservable();
	}

	public get _isCheckDatabase(): boolean {
		return this._isCheckDatabase$.getValue();
	}

	public get _isCheckHost(): {
		isLoading: boolean;
		isHidden: boolean;
		message: string;
		status: boolean;
	} {
		return this._isCheckHost$.getValue();
	}

	public get isCheckHost$(): Observable<{
		isLoading: boolean;
		isHidden: boolean;
		message: string;
		status: boolean;
	}> {
		return this._isCheckHost$.asObservable();
	}

	public get isCheckDatabase$(): Observable<boolean> {
		return this._isCheckDatabase$.asObservable();
	}

	public get restartDisable$(): Observable<boolean> {
		return this._restartDisable$.asObservable();
	}

	public get isHidden$(): Observable<boolean> {
		return this._isHidden$.asObservable();
	}

	public onHide() {
		this._isHidden$.next(true);
	}

	public onHideApi() {
		this._isCheckHost$.next({
			...this._isCheckHost,
			isHidden: true
		});
	}

	public async checkHostConnectivity(): Promise<any> {
		try {
			this._isCheckHost$.next({
				...this._isCheckHost,
				isLoading: true
			});
			const url = new URL(this.config.serverUrl);
			if (url.pathname.length > 1) {
				this.config.serverUrl = url.origin;
			}
			const isOk = await this._setupService.pingServer({
				host: url.origin
			});
			if (isOk) {
				this._isCheckHost$.next({
					status: true,
					isHidden: false,
					isLoading: false,
					message: 'TIMER_TRACKER.SETTINGS.MESSAGES.CONNECTION_SUCCEEDS'
				});
			}
		} catch (error) {
			this._isCheckHost$.next({
				status: false,
				isHidden: false,
				isLoading: false,
				message: error.message
			});
		}
	}

	public onHostChange(host: string) {
		this._restartDisable$.next(true);
	}

	private get _monitorsOption() {
		return this._monitorsOption$.getValue();
	}

	public get monitorsOption$(): Observable<any> {
		return this._monitorsOption$.asObservable();
	}

	public humanize(value: number): string {
		return moment.duration(value, 'hours').humanize(false, {});
	}

	public get automaticUpdateDelay$(): Observable<number> {
		return this._automaticUpdateDelay$.asObservable();
	}

	public get simpleScreenshotNotification$(): Observable<boolean> {
		return this._simpleScreenshotNotification$.asObservable();
	}

	public get simpleScreenshotNotification(): boolean {
		return this._simpleScreenshotNotification$.getValue();
	}

	public get isRestart$(): Observable<boolean> {
		return this._isRestart$.asObservable();
	}

	public updateSslSetting(value) {
		this.updateServerConfig(value, 'secureProxy');
	}

	public updateServerConfig(value, type: string, showNotification = true) {
		this.config[type] = value;
		this.electronService.ipcRenderer.send('update_server_config', this.config);
		if (showNotification) {
			this._notifier.success(
				'Update ' + type.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase() + ' setting successfully'
			);
		}
	}
}
