import { Component, OnInit } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { ElectronService } from '../../electron/services';

@Component({
	selector: 'gauzy-switch-theme',
	templateUrl: './switch-theme.component.html',
	styleUrls: ['./switch-theme.component.scss']
})
export class SwitchThemeComponent implements OnInit {
	switch = true; // Default theme can be light
	hasText = false;

	constructor(
		private translate: TranslateService,
		private electronService: ElectronService
	) { }

	ngOnInit(): void {
		this.electronService.ipcRenderer.invoke('SAVED_THEME').then((theme) => {
			this.switch = theme === 'dark';
		});
	}

	switchTheme(): void {
		const currentTheme = this.switch;
		this.switch = !currentTheme;
		this.electronService.ipcRenderer.send('THEME_CHANGE', this.switch ? 'dark' : 'light');
	}
}
