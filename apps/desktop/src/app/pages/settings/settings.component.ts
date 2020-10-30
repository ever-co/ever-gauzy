import {
	Component,
	OnInit,
	ChangeDetectionStrategy,
	ViewChild,
	ElementRef
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
	menus = ['Screen Capture', 'Timer', 'Advanced Setting'];

	montorsOption = [
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
	periodeOption = [1, 5, 10];
	selectedPeriod = null;
	screenshotNotification = null;
	config = null;
	constructor(private electronService: ElectronService) {
		this.electronService.ipcRenderer.on('app_setting', (event, arg) => {
			const { setting, config } = arg;
			this.appSetting = setting;
			this.config = config;
			this.config.awPort = this.config.awAPI.split('t:')[1];
			this.config.serverType = this.config.isLocalServer
				? 'Local'
				: 'External';
			this.selectMonitorOption({
				value: setting.monitor.captured
			});
			this.screenshotNotification = setting.screenshotNotification;
			this.selectPeriod(setting.timer.updatePeriode);
			this.selectProjectElement.nativeElement.focus();
			const el: HTMLElement = this.selectProjectElement
				.nativeElement as HTMLElement;
			setTimeout(() => el.click(), 1000);
		});

		this.electronService.ipcRenderer.on(
			'app_setting_update',
			(event, arg) => {
				const { setting } = arg;
				this.appSetting = setting;
			}
		);
	}

	ngOnInit(): void {
		this.electronService.ipcRenderer.send('request_permission');
	}

	selectMonitorOption(item) {
		this.monitorOptionSelected = item.value;
		this.updateSetting({ captured: item.value }, 'monitor');
		this.montorsOption = this.montorsOption.map((x) => {
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
	}

	updateSetting(value, type) {
		this.appSetting[type] = value;
		this.electronService.ipcRenderer.send('update_app_setting', {
			values: this.appSetting
		});
	}

	selectPeriod(value) {
		this.selectedPeriod = value;
		this.updateSetting({ updatePeriode: value }, 'timer');
	}

	toggleNotificationChange(value) {
		this.updateSetting(value, 'screenshotNotification');
	}

	restartApp() {
		this.electronService.ipcRenderer.send('restart_app', {
			port: this.config.port,
			dbPort: this.config.dbPort,
			awAPI: `http://localhost:${this.config.awPort}`
		});
	}
}
