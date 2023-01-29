import {
	Component,
	OnInit,
	ChangeDetectionStrategy,
	ViewChild,
	ElementRef,
	NgZone,
	AfterViewInit,
} from '@angular/core';
import { TimeTrackerService } from '../time-tracker/time-tracker.service';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { ElectronService } from '../electron/services';
import { BehaviorSubject, Observable } from 'rxjs';
import { AboutComponent } from '../dialogs/about/about.component';
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
		`,
	],
})
export class SettingsComponent implements OnInit, AfterViewInit {
	@ViewChild('selectRef') selectProjectElement: ElementRef;
	@ViewChild('logBox', { read: ElementRef })
	set logobox(content: ElementRef) {
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
	logIsOpen: boolean = false;

	appName: string = this.electronService.remote.app.getName();
	menus =
		this.appName === 'gauzy-server'
			? ['Update', 'Advanced Setting', 'About']
			: [
					'Screen Capture',
					'Timer',
					'Update',
					'Advanced Setting',
					'About',
			  ];
	gauzyIcon =
		this.appName === 'gauzy-desktop-timer' ||
		this.appName === 'gauzy-server'
			? './assets/images/logos/logo_Gauzy.svg'
			: '../assets/images/logos/logo_Gauzy.svg';

	monitorsOption = [
		{
			value: 'all',
			title: 'Capture All Monitors',
			subtitle: 'All connected monitors',
			accent: 'basic',
			status: 'basic',
		},
		{
			value: 'active-only',
			title: 'Capture Active Monitor',
			subtitle: 'Monitor current pointer position',
			iconStyle: 'all-monitor_icon',
			accent: 'basic',
			status: 'basic',
		},
	];

	thirdPartyConfig = [
		{
			title: 'Unleash',
			fields: [
				{
					name: 'UNLEASH_APP_NAME',
					field: 'UNLEASH_APP_NAME',
					value: '',
				},
				{
					name: 'UNLEASH_API_URL',
					field: 'UNLEASH_API_URL',
					value: '',
				},
				{
					name: 'UNLEASH_INSTANCE_ID',
					field: 'UNLEASH_INSTANCE_ID',
					value: '',
				},
				{
					name: 'UNLEASH_REFRESH_INTERVAL',
					field: 'UNLEASH_REFRESH_INTERVAL',
					value: 15000,
				},
				{
					name: 'UNLEASH_METRICS_INTERVAL',
					field: 'UNLEASH_METRICS_INTERVAL',
					value: 60000,
				},
				{
					name: 'UNLEASH_API_KEY',
					field: 'UNLEASH_API_KEY',
					value: '',
				},
			],
		},
		{
			title: 'Twitter',
			fields: [
				{
					name: 'TWITTER_CLIENT_ID',
					field: 'TWITTER_CLIENT_ID',
					value: '',
				},
				{
					name: 'TWITTER_CLIENT_SECRET',
					field: 'TWITTER_CLIENT_SECRET',
					value: '',
				},
				{
					name: 'TWITTER_CALLBACK_URL',
					field: 'TWITTER_CALLBACK_URL',
					value: 'http://localhost:3000/api/auth/twitter/callback',
				},
			],
		},
		{
			title: 'Google',
			fields: [
				{
					name: 'GOOGLE_CLIENT_ID',
					field: 'GOOGLE_CLIENT_ID',
					value: '',
				},
				{
					name: 'GOOGLE_CLIENT_SECRET',
					field: 'GOOGLE_CLIENT_SECRET',
					value: '',
				},
				{
					name: 'GOOGLE_CALLBACK_URL',
					field: 'GOOGLE_CALLBACK_URL',
					value: 'http://localhost:3000/api/auth/google/callback',
				},
			],
		},
		{
			title: 'Facebook',
			fields: [
				{
					name: 'FACEBOOK_CLIENT_ID',
					field: 'FACEBOOK_CLIENT_ID',
					value: '',
				},
				{
					name: 'FACEBOOK_CLIENT_SECRET',
					field: 'FACEBOOK_CLIENT_SECRET',
					value: '',
				},
				{
					name: 'FACEBOOK_CALLBACK_URL',
					field: 'FACEBOOK_CALLBACK_URL',
					value: '',
				},
				{
					name: 'FACEBOOK_GRAPH_VERSION',
					field: 'FACEBOOK_GRAPH_VERSION',
					value: '',
				},
			],
		},
		{
			title: 'Github',
			fields: [
				{
					name: 'GITHUB_CLIENT_ID',
					field: 'GITHUB_CLIENT_ID',
					value: '',
				},
				{
					name: 'GITHUB_CLIENT_SECRET',
					field: 'GITHUB_CLIENT_SECRET',
					value: '',
				},
				{
					name: 'GITHUB_CALLBACK_URL',
					field: 'GITHUB_CALLBACK_URL',
					value: '',
				},
			],
		},
		{
			title: 'LinkedIn',
			fields: [
				{
					name: 'LINKEDIN_CLIENT_ID',
					field: 'LINKEDIN_CLIENT_ID',
					value: '',
				},
				{
					name: 'LINKEDIN_CLIENT_SECRET',
					field: 'LINKEDIN_CLIENT_SECRET',
					value: '',
				},
				{
					name: 'LINKEDIN_CALLBACK_URL',
					field: 'LINKEDIN_CALLBACK_URL',
					value: '',
				},
			],
		},
		{
			title: 'Microsoft',
			fields: [
				{
					name: 'MICROSOFT_CLIENT_ID',
					field: 'MICROSOFT_CLIENT_ID',
					value: '',
				},
				{
					name: 'MICROSOFT_CLIENT_SECRET',
					field: 'MICROSOFT_CLIENT_SECRET',
					value: '',
				},
				{
					name: 'MICROSOFT_RESOURCE',
					field: 'MICROSOFT_RESOURCE',
					value: '',
				},
				{
					name: 'MICROSOFT_TENANT',
					field: 'MICROSOFT_TENANT',
					value: '',
				},
				{
					name: 'MICROSOFT_CALLBACK_URL',
					field: 'MICROSOFT_CALLBACK_URL',
					value: '',
				},
			],
		},
		{
			title: 'Fiverr',
			fields: [
				{
					name: 'FIVERR_CLIENT_ID',
					field: 'FIVERR_CLIENT_ID',
					value: '',
				},
				{
					name: 'FIVERR_CLIENT_SECRET',
					field: 'FIVERR_CLIENT_SECRET',
					value: '',
				},
			],
		},
		{
			title: 'Auth0',
			fields: [
				{
					name: 'AUTH0_CLIENT_ID',
					field: 'AUTH0_CLIENT_ID',
					value: '',
				},
				{
					name: 'AUTH0_CLIENT_SECRET',
					field: 'AUTH0_CLIENT_SECRET',
					value: '',
				},
				{
					name: 'AUTH0_DOMAIN',
					field: 'AUTH0_DOMAIN',
					value: '',
				},
			],
		},
		{
			title: 'Keycloak',
			fields: [
				{
					name: 'KEYCLOAK_REALM',
					field: 'KEYCLOAK_REALM',
					value: '',
				},
				{
					name: 'KEYCLOAK_CLIENT_ID',
					field: 'KEYCLOAK_CLIENT_ID',
					value: '',
				},
				{
					name: 'KEYCLOAK_SECRET',
					field: 'KEYCLOAK_SECRET',
					value: '',
				},
				{
					name: 'KEYCLOAK_AUTH_SERVER_URL',
					field: 'KEYCLOAK_AUTH_SERVER_URL',
					value: '',
				},
				{
					name: 'KEYCLOAK_COOKIE_KEY',
					field: 'KEYCLOAK_COOKIE_KEY',
					value: '',
				},
			],
		},
		{
			title: 'Other',
			fields: [
				{
					name: 'SENTRY_DSN',
					field: 'SENTRY_DSN',
					value: '',
				},
				{
					name: 'GOOGLE_MAPS_API_KEY',
					field: 'GOOGLE_MAPS_API_KEY',
					value: '',
				},
			],
		},
	];

	selectedMenu =
		this.appName === 'gauzy-server' ? 'Update' : 'Screen Capture';

	monitorOptionSelected = null;
	appSetting = null;
	periodOption = [1, 3, 5, 10, 20];
	selectedPeriod = 5;
	screenshotNotification = null;
	config = null;
	restartDisable = false;
	version = '0.0.0';
	message = {
		text: 'Application Update',
		status: 'basic',
	};
	downloadFinish = false;
	progressDownload = 0;
	showProgressBar = false;
	autoLaunch = null;
	minimizeOnStartup = null;
	authSetting = null;
	currentUser$: BehaviorSubject<any> = new BehaviorSubject({});
	serverTypes = {
		integrated: 'Integrated',
		localNetwork: 'Local Network',
		live: 'Live',
	};
	waitRestart = false;
	serverIsRunning = false;

	serverOptions =
		this.appName === 'gauzy-desktop-timer'
			? [this.serverTypes.localNetwork, this.serverTypes.live]
			: [
					this.serverTypes.integrated,
					this.serverTypes.localNetwork,
					this.serverTypes.live,
			  ];

	driverOptions = ['sqlite', 'postgres', 'mysql'];
	muted: boolean;

	private _loading$: BehaviorSubject<boolean>;
	private _automaticUpdate$: BehaviorSubject<boolean>;
	private _available$: BehaviorSubject<boolean>;
	private _updaterServer$: BehaviorSubject<any>;
	private _file$: BehaviorSubject<any>;
	private _prerelease$: BehaviorSubject<boolean>;

	constructor(
		private electronService: ElectronService,
		private _ngZone: NgZone,
		private readonly timeTrackerService: TimeTrackerService,
		private toastrService: NbToastrService,
		private _dialogService: NbDialogService
	) {
		this._loading$ = new BehaviorSubject(false);
		this._automaticUpdate$ = new BehaviorSubject(false);
		this._available$ = new BehaviorSubject(false);
		this._file$ = new BehaviorSubject({ uri: null });
		this._updaterServer$ = new BehaviorSubject({
			github: false,
			digitalOcean: true,
			local: false,
		});
		this._prerelease$ = new BehaviorSubject(false);
	}

	ngOnInit(): void {
		this.electronService.ipcRenderer.send('request_permission');
		this.version = this.electronService.remote.app.getVersion();
	}

	ngAfterViewInit(): void {
		this.electronService.ipcRenderer.on('app_setting', (event, arg) =>
			this._ngZone.run(() => {
				const { setting, config, auth, additionalSetting } = arg;
				this.appSetting = setting;
				this.config = config;
				this.authSetting = auth;
				this.mappingAdditionalSetting(additionalSetting || null);

				this.config.awPort = this.config.timeTrackerWindow
					? this.config.awHost.split('t:')[1]
					: null;
				this.serverConnectivity();
				this.selectMonitorOption({
					value: setting.monitor.captured,
				});
				this.screenshotNotification = setting.screenshotNotification;
				this.muted = setting.mutedNotification;
				this.autoLaunch = setting.autoLaunch;
				this.minimizeOnStartup = setting.minimizeOnStartup;
				this._automaticUpdate$.next(setting.automaticUpdate);
				this._prerelease$.next(setting.prerelease);
				this._updaterServer$ = new BehaviorSubject({
					github: setting.cdnUpdater.github,
					digitalOcean: setting.cdnUpdater.digitalOcean,
					local: false,
				});
				this.selectPeriod(setting.timer.updatePeriod);
				if (this.appName !== 'gauzy-server') {
					this.getUserDetails();
				}
			})
		);

		this.electronService.ipcRenderer.on(
			'app_setting_update',
			(event, arg) =>
				this._ngZone.run(() => {
					const { setting } = arg;
					this.appSetting = setting;
				})
		);

		this.electronService.ipcRenderer.on('update_not_available', () =>
			this._ngZone.run(() => {
				this._available$.next(false);
				this.message = {
					text: 'Update Not Available',
					status: 'basic',
				};
				this.logContents = this.message.text;
				this.scrollToBottom();
				this._loading$.next(false);
			})
		);

		this.electronService.ipcRenderer.on('error_update', (event, arg) =>
			this._ngZone.run(() => {
				this._available$.next(false);
				this.message = {
					text: 'Update Error',
					status: 'danger',
				};
				this.logContents = this.message.text;
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
					text: 'Update Available',
					status: 'primary',
				};
				this.logContents = this.message.text;
				this.scrollToBottom();
			})
		);

		this.electronService.ipcRenderer.on('update_downloaded', () =>
			this._ngZone.run(() => {
				this._available$.next(true);
				this.message = {
					text: 'Update Download Completed',
					status: 'success',
				};
				this.logContents = this.message.text;
				this.scrollToBottom();
				this.showProgressBar = false;
				this.downloadFinish = true;
				this._loading$.next(false);
			})
		);

		this.electronService.ipcRenderer.on(
			'download_on_progress',
			(event, arg) =>
				this._ngZone.run(() => {
					this._loading$.next(true);
					this._available$.next(true);
					this.showProgressBar = true;
					this.message = {
						text: 'Update Downloading',
						status: 'warning',
					};
					this.progressDownload = Math.floor(Number(arg.percent));
					this.logContents = `Downloading update ${Math.floor(
						arg.transferred / 1000000
					)} MB of ${Math.floor(
						arg.total / 1000000
					)} MB  ->> ${Math.floor(arg.bytesPerSecond / 1000)} KB/s`;
					this.scrollToBottom();
				})
		);

		this.electronService.ipcRenderer.on('goto_update', () =>
			this._ngZone.run(() => {
				this.selectMenu('Update');
			})
		);

		this.electronService.ipcRenderer.on('goto_top_menu', () =>
			this._ngZone.run(() => {
				if (this.appName === 'gauzy-server') {
					this.selectMenu('Advanced Setting');
				} else this.selectMenu('Screen Capture');
			})
		);

		this.electronService.ipcRenderer.on('goto_advanced_setting', () => {
			this.selectMenu('Advanced Setting');
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

		this.electronService.ipcRenderer.on(
			'update_files_directory',
			(event, arg) => {
				this._ngZone.run(() => {
					this._file$.next(arg);
				});
			}
		);

		this.electronService.ipcRenderer.on('show_about', () => {
			this._ngZone.run(() => {
				this._dialogService.open(AboutComponent);
			});
		});
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
		this.monitorOptionSelected = item.value;
		this.updateSetting({ captured: item.value }, 'monitor');
		this.monitorsOption = this.monitorsOption.map((x) => {
			if (x.value === item.value) {
				x.accent = 'primary';
				x.status = 'primary';
			} else {
				x.accent = 'basic';
				x.status = 'basic';
			}
			return x;
		});
	}

	selectMenu(menu) {
		this.selectedMenu = menu;
	}

	updateSetting(value, type) {
		this.appSetting[type] = value;
		this.electronService.ipcRenderer.send('update_app_setting', {
			values: this.appSetting,
		});
	}

	selectPeriod(value) {
		this.selectedPeriod = value;
		this.updateSetting({ updatePeriod: value }, 'timer');
	}

	toggleNotificationChange(value) {
		this.updateSetting(value, 'screenshotNotification');
		this.updateSetting(!value, 'simpleScreenshotNotification');
	}

	toggleSimpleNotificationChange(value) {
		this.updateSetting(value, 'simpleScreenshotNotification');
		this.updateSetting(!value, 'screenshotNotification');
		this.screenshotNotification = !value;
	}

	toggleNotificationSoundChange(value) {
		this.updateSetting(value, 'mutedNotification');
		this.muted = value;
	}

	toggleAutoLaunch(value) {
		this.updateSetting(value, 'autoLaunch');
		this.electronService.ipcRenderer.send('launch_on_startup', {
			autoLaunch: value,
			hidden: this.minimizeOnStartup,
		});
	}

	toggleMinimizeOnStartup(value) {
		this.updateSetting(value, 'minimizeOnStartup');
		this.electronService.ipcRenderer.send('minimize_on_startup', {
			autoLaunch: this.autoLaunch,
			hidden: value,
		});
	}

	toggleAutomaticUpdate(value) {
		this._automaticUpdate$.next(value);
		this.updateSetting(value, 'automaticUpdate');
	}

	togglePrerelease(value) {
		this._prerelease$.next(value);
		this.updateSetting(value, 'prerelease');
	}

	restartApp() {
		if (this.appName === 'gauzy-server' && this.serverIsRunning) {
			this.restartDisable = true;
		} else {
			this.logout();
		}
		const thConfig = {};
		this.thirdPartyConfig.forEach((item) => {
			item.fields.forEach((itemField) => {
				thConfig[itemField.field] = itemField.value;
			});
		});
		const newConfig: any = {
			...this.config,
		};
		if (this.config.timeTrackerWindow)
			newConfig.awHost = `http://localhost:${this.config.awPort}`;
		this.electronService.ipcRenderer.send('restart_app', newConfig);
		this.electronService.ipcRenderer.send(
			'save_additional_setting',
			thConfig
		);
	}

	portChange(val, type) {
		if (type === 'api') {
			if (
				['5621', '5622'].findIndex((item) => item === val.toString()) >
				-1
			) {
				this.restartDisable = true;
			} else {
				this.restartDisable = false;
			}
		}
		if (type === 'db') {
			console.log('Port change', val);
		}
	}

	serverConnectivity() {
		switch (true) {
			case this.config.isLocalServer:
				this.config.serverType = 'Integrated';
				break;
			case !this.config.isLocalServer &&
				this.config.serverUrl !== 'https://api.gauzy.co':
				this.config.serverType = 'Local Network';
				break;
			case !this.config.isLocalServer &&
				this.config.serverUrl === 'https://api.gauzy.co':
				this.config.serverType = 'Live';
				break;
			default:
				break;
		}
	}

	checkForUpdate() {
		this._loading$.next(true);
		this.logIsOpen = true;
		this.electronService.ipcRenderer.send('check_for_update');
	}

	restartAndUpdate() {
		this.electronService.ipcRenderer.send('restart_and_update');
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
	getUserDetails() {
		const request = {
			...this.authSetting,
			...this.config,
			apiHost: this.config.serverUrl,
		};
		if (this.authSetting) {
			this.timeTrackerService.getUserDetail(request).then((res) => {
				if (!this.authSetting.isLogout) {
					this.currentUser$.next(res);
				} else {
					this.currentUser$.next(null);
				}
			});
		} else {
			this.currentUser$.next(null);
		}
	}

	/*
	 * Logout desktop timer
	 */
	logout() {
		console.log('On Logout');
		this.electronService.ipcRenderer.send('logout_desktop');
	}

	onServerChange(val) {
		switch (val) {
			case this.serverTypes.integrated:
				this.config.isLocalServer = true;
				this.config.port = 5620;
				this.config.serverUrl = null;
				break;
			case this.serverTypes.localNetwork:
				this.config.isLocalServer = false;
				this.config.serverUrl = 'http://localhost:3000';
				break;
			case this.serverTypes.live:
				this.config.isLocalServer = false;
				this.config.serverUrl = 'https://api.gauzy.co';
				break;
			default:
				break;
		}
	}

	onDriverChange(val) {
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
			default:
				break;
		}
	}

	showAlert(arg) {
		let message = '';
		switch (arg.type) {
			case 'update_config':
				message =
					'Server configuration updated, please wait till server restarts';
				break;
			case 'start_server':
				this.restartDisable = false;
				message = 'Server Restated Successfully';
				break;
			default:
				break;
		}
		this.toastrService.show(message, `Success`, { status: arg.status });
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
			this._logBox.nativeElement.scrollTop =
				this._logBox.nativeElement.scrollHeight;
		}
	}

	public togglePreventDisplaySleep(event: boolean): void {
		this.updateSetting(event, 'preventDisplaySleep');
	}

	public openLink() {
		const url = 'https://gauzy.co';
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
			local: false,
		});
		this.updateSetting(this._updaterServer$.getValue(), 'cdnUpdater');
		this.electronService.ipcRenderer.send(
			'change_update_strategy',
			this._updaterServer$.getValue()
		);
	}

	public toggleDigitalOceanDefaultServer(event: boolean) {
		this._updaterServer$.next({
			github: !event,
			digitalOcean: event,
			local: false,
		});
		this.updateSetting(this._updaterServer$.getValue(), 'cdnUpdater');
		this.electronService.ipcRenderer.send(
			'change_update_strategy',
			this._updaterServer$.getValue()
		);
	}

	public toggleLocalServer(event: boolean) {
		this._file$.next({});
		this._updaterServer$.next({
			...this._updaterServer$.getValue(),
			local: event,
		});
		this.electronService.ipcRenderer.send(
			'change_update_strategy',
			this._updaterServer$.getValue()
		);
	}
}
