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
	menus = ['Screen Capture', 'Timer'];

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
	constructor(private electronService: ElectronService) {
		this.electronService.ipcRenderer.on('app_setting', (event, arg) => {
			const { setting } = arg;
			this.appSetting = setting;
			this.selectMonitorOption({
				value: setting.monitor.captured
			});
			this.selectPeriod(setting.timer.updatePeriode);
			this.selectProjectElement.nativeElement.focus();
			const el: HTMLElement = this.selectProjectElement
				.nativeElement as HTMLElement;
			setTimeout(() => el.click(), 1000);
		});
	}

	ngOnInit(): void {}

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
		console.log('change minute', value);
		this.selectedPeriod = value;
		this.updateSetting({ updatePeriode: value }, 'timer');
	}
}
