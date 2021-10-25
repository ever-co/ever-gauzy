import {
	Component,
	OnInit,
	ChangeDetectionStrategy,
	ViewChild,
	ElementRef,
	ChangeDetectorRef
} from '@angular/core';
import { Router } from '@angular/router';
import { TimeTrackerService } from '../time-tracker/time-tracker.service';
import { NbToastrService } from '@nebular/theme';
import { ElectronServices } from '../electron/services';
@Component({
	selector: 'ngx-settings',
	templateUrl: './settings.component.html',
	styleUrls: ['./settings.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: [`
    :host nb-tab {
      padding: 1.25rem;
    }
  `],
})
export class SettingsComponent implements OnInit {
	@ViewChild('selectRef') selectProjectElement: ElementRef;
	@ViewChild('logbox') logbox: ElementRef;
	@ViewChild('logUpdate') logAccordion;
	logContents:any = [];
	logIsOpen:boolean = false;

	appName: string = this.electronService.remote.app.getName();
	menus = this.appName === 'gauzy-server' ? ['Update', 'Advanced Setting'] : ['Screen Capture', 'Timer', 'Update', 'Advanced Setting'];
	gauzyIcon =
		this.appName === 'gauzy-desktop-timer' || this.appName === 'gauzy-server'
			? './assets/images/logos/logo_Gauzy.svg'
			: '../assets/images/logos/logo_Gauzy.svg';

	monitorsOption = [
		{
			value: 'all',
			title: 'Capture All Monitors',
			subtitle: 'All connected monitors',
			accent: 'basic',
			status: 'basic'
		},
		{
			value: 'active-only',
			title: 'Capture Active Monitor',
			subtitle: 'Monitor current pointer position',
			iconStyle: 'all-monitor_icon',
			accent: 'basic',
			status: 'basic'
		}
	];

	thirdPartyConfig = [
		{
			title: 'UNLEASH_APP',
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
					value: 1000
				},
				{
					name: 'UNLEASH_METRICS_INTERVAL',
					field: 'UNLEASH_METRICS_INTERVAL',
					value: 1000
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
					value: 'http://localhost:3000/api/auth/twitter/callback'
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
					value: 'http://localhost:3000/api/auth/google/callback'
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
					name: 'GITHUB_CLIENT_ID',
					field: 'GITHUB_CLIENT_ID',
					value: ''
				},
				{
					name: 'GITHUB_CLIENT_SECRET',
					field: 'GITHUB_CLIENT_SECRET',
					value: ''
				},
				{
					name: 'GITHUB_CALLBACK_URL',
					field: 'GITHUB_CALLBACK_URL',
					value: ''
				}
			]
		},
		{
			title: 'Linkedin',
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
				},
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
			title: 'KEYCLOAK',
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
		},
	]

	selectedMenu = 'Screen Capture';

	monitorOptionSelected = null;
	appSetting = null;
	periodOption = [1, 5, 10];
	selectedPeriod = 10;
	screenshotNotification = null;
	config = null;
	restartDisable = false;
	loading = false;
	version = '0.0.0';
	notAvailable = false;
	message = 'Application Update';
	downloadFinish = false;
	progressDownload = 0;
	showProgressBar = false;
	autoLaunch = null;
	minimizeOnStartup = null;
	authSetting = null;
	currentUser = null;
	serverTypes = {
		integrated: 'Integrated',
		localNetwork: 'Local Network',
		live: 'Live'
	};
	waitRestart = false;
	serverIsRunning = false;

	serverOptions =
		this.appName === 'gauzy-desktop-timer'
			? [this.serverTypes.localNetwork, this.serverTypes.live]
			: [
					this.serverTypes.integrated,
					this.serverTypes.localNetwork,
					this.serverTypes.live
			  ];

	driverOptions = ['sqlite', 'postgres'];

	constructor(
		private electronService: ElectronServices,
		private _cdr: ChangeDetectorRef,
		private readonly router: Router,
		private readonly timeTrackerService: TimeTrackerService,
		private toastrService: NbToastrService,
	) {
		this.electronService.ipcRenderer.on('app_setting', (event, arg) => {
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
				value: setting.monitor.captured
			});
			this.screenshotNotification = setting.screenshotNotification;
			this.autoLaunch = setting.autoLaunch;
			this.minimizeOnStartup = setting.minimizeOnStartup;

			this.selectPeriod(setting.timer.updatePeriod);
			if (this.appName !== 'gauzy-server') {
				this.getUserDetails();
			}

			this._cdr.detectChanges();
		});

		this.electronService.ipcRenderer.on(
			'app_setting_update',
			(event, arg) => {
				const { setting } = arg;
				this.appSetting = setting;
			}
		);

		electronService.ipcRenderer.on('update_not_available', () => {
			this.notAvailable = true;
			this.message = 'Update Not Available';
			this.logContents.push(this.message);
			this.scrollToBottom();
			this.loading = false;
			this._cdr.detectChanges();
		});

		electronService.ipcRenderer.on('error_update', (event, arg) => {
			this.notAvailable = true;
			this.message = 'Update Error';
			this.logContents.push(this.message);
			this.logContents.push(`error message: ${arg}`)
			this.scrollToBottom();
			this._cdr.detectChanges();
		});

		electronService.ipcRenderer.on('update_available', () => {
			this.notAvailable = true;
			this.message = 'Update Available';
			this.logContents.push(this.message);
			this.scrollToBottom();
			this._cdr.detectChanges();
		});

		electronService.ipcRenderer.on('update_downloaded', () => {
			this.notAvailable = true;
			this.message = 'Update Download Completed';
			this.logContents.push(this.message);
			this.scrollToBottom();
			this.showProgressBar = false;
			this.downloadFinish = true;
			this.loading = false;
			this._cdr.detectChanges();
		});

		electronService.ipcRenderer.on('download_on_progress', (event, arg) => {
			this.notAvailable = true;
			this.showProgressBar = true;
			this.message = `Update Downloading`;
			this.progressDownload = Math.floor(Number(arg.percent));
			this.logContents.push(`Downloading update ${Math.floor(arg.transferred/1000000)} MB of ${Math.floor(arg.total/1000000)} MB  ->> ${Math.floor(arg.bytesPerSecond/1000)} KB/s`);
			this.scrollToBottom();
			this._cdr.detectChanges();
		});

		electronService.ipcRenderer.on('goto_update', () => {
			this.selectMenu('Update');
		});

		electronService.ipcRenderer.on('goto_top_menu', () => {
			if (this.appName === 'gauzy-server') {
				this.selectMenu('Advanced Setting');
			} else this.selectMenu('Screen Capture');
		});

		electronService.ipcRenderer.on('goto_advanced_setting', () => {
			this.selectMenu('Advanced Setting');
		});

		electronService.ipcRenderer.on('logout_success', () => {
			this.currentUser = null;
			this._cdr.detectChanges();
		})

		electronService.ipcRenderer.on('resp_msg', (event, arg) => {
			this.showAlert(arg);
		})
		electronService.ipcRenderer.on('server_status', (event, arg) => {
			this.serverIsRunning = arg;
		})
	}

	ngOnInit(): void {
		this.electronService.ipcRenderer.send('request_permission');
		this.version = this.electronService.remote.app.getVersion();
	}

	mappingAdditionalSetting(values) {
		if (values) {
			this.thirdPartyConfig.forEach((item) => {
				item.fields.forEach((itemField) => {
					itemField.value = values[itemField.field];
				})
			})
		}
	}

	selectMonitorOption(item) {
		this.monitorOptionSelected = item.value;
		this.updateSetting({ captured: item.value }, 'monitor');
		this.monitorsOption = this.monitorsOption.map((x) => {
			if (x.value === item.value) {
				x.accent = 'success';
				x.status = 'success';
			} else {
				x.accent = 'basic';
				x.status = 'basic';
			}
			return x;
		});
	}

	selectMenu(menu) {
		this.selectedMenu = menu;
		this._cdr.detectChanges();
	}

	updateSetting(value, type) {
		this.appSetting[type] = value;
		this.electronService.ipcRenderer.send('update_app_setting', {
			values: this.appSetting
		});
	}

	selectPeriod(value) {
		this.selectedPeriod = value;
		this.updateSetting({ updatePeriod: value }, 'timer');
	}

	toggleNotificationChange(value) {
		this.updateSetting(value, 'screenshotNotification');
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

	restartApp() {
		if (this.appName === 'gauzy-server' && this.serverIsRunning) {
			this.restartDisable = true;
		}
		const thConfig = {};
		this.thirdPartyConfig.forEach((item) => {
			item.fields.forEach((itemField) => {
				thConfig[itemField.field] = itemField.value;
			})
		});
		const newConfig: any = {
			...this.config
		};
		if (this.config.timeTrackerWindow)
			newConfig.awHost = `http://localhost:${this.config.awPort}`;
		this.electronService.ipcRenderer.send('restart_app', newConfig);
		this.electronService.ipcRenderer.send('save_additional_setting', thConfig);
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
		this.loading = true;
		this.logIsOpen = true;
		this.electronService.ipcRenderer.send('check_for_update');
		this._cdr.detectChanges();
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
			apiHost: this.config.serverUrl
		};
		this.timeTrackerService.getUserDetail(request).then((res) => {
			if (!this.authSetting.isLogout) {
				this.currentUser = res;
			}
			this._cdr.detectChanges();
		});
	}

	/*
	 * Logout desktop timer
	 */
	logout() {
		console.log('On Logout s');
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
			default:
				break;
		}
	}

	showAlert(arg) {
		let message = '';
		switch (arg.type) {
			case 'update_config':
				message = 'Server configuration updated, please wait for server restart';
				break;
			case 'start_server':
				this.restartDisable = false;
				this._cdr.detectChanges();
				message = 'Server Successfully restated'
				break;
			default:
				break;
		}
		this.toastrService.show(
			message,
			`Success`,
			{ status: arg.status }
		);
	}
	logBoxChange(e) {
		if (e) {
			this.logIsOpen = false;
		} else {
			this.logIsOpen = true;
		}
	}

	private scrollToBottom() {
        this.logbox.nativeElement.scrollTop = this.logbox.nativeElement.scrollHeight;
    }
}
