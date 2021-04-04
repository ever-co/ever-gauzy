import {
	Component,
	OnInit,
	ChangeDetectionStrategy,
	ViewChild,
	ElementRef,
	ChangeDetectorRef
} from '@angular/core';
import { ElectronService } from 'ngx-electron';
@Component({
	selector: 'ngx-settings',
	templateUrl: './settings.component.html',
	styleUrls: ['./settings.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent implements OnInit {
	@ViewChild('selectRef') selectProjectElement: ElementRef;
	menus = ['Screen Capture', 'Timer', 'Update', 'Advanced Setting'];
	appName: string = this.electronService.remote.app.getName();
	gauzyIcon =
		this.appName === 'gauzy-desktop-timer'
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
	message = 'Application Uptodate';
	downloadFinish = false;
	progressDownload = 0;
	showProgressBar = false;
	autoLaunch = null;
	minimizeOnStartup = null;

	constructor(
		private electronService: ElectronService,
		private _cdr: ChangeDetectorRef
	) {
		this.electronService.ipcRenderer.on('app_setting', (event, arg) => {
			const { setting, config } = arg;
			this.appSetting = setting;
			this.config = config;
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
			this.message = 'Application Uptodate';
			this.loading = false;
			this._cdr.detectChanges();
		});

		electronService.ipcRenderer.on('error_update', (event, arg) => {
			this.notAvailable = true;
			this.message = 'Update Error';
			this._cdr.detectChanges();
		});

		electronService.ipcRenderer.on('update_available', () => {
			this.notAvailable = true;
			this.message = 'Update Available';
			this._cdr.detectChanges();
		});

		electronService.ipcRenderer.on('update_downloaded', () => {
			this.notAvailable = true;
			this.message = 'Update Download Completed';
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
			this._cdr.detectChanges();
		});

		electronService.ipcRenderer.on('goto_update', () => {
			this.selectMenu('Update');
		});

		electronService.ipcRenderer.on('goto_top_menu', () => {
			this.selectMenu('Screen Capture');
		});
	}

	ngOnInit(): void {
		this.electronService.ipcRenderer.send('request_permission');
		this.version = this.electronService.remote.app.getVersion();
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
		const newConfig: any = {
			port: this.config.port,
			dbPort: this.config.dbPort
		};
		if (this.config.timeTrackerWindow)
			newConfig.awHost = `http://localhost:${this.config.awPort}`;
		this.electronService.ipcRenderer.send('restart_app', newConfig);
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
}
