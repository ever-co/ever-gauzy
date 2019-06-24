import { Component } from '@angular/core';
import { NbThemeService } from '@nebular/theme';

@Component({
	selector: 'ngx-theme-settings',
	styleUrls: ['./theme-settings.component.scss'],
	templateUrl: './theme-settings.component.html'
})
export class ThemeSettingsComponent {
	themes = [
		{
			value: 'default',
			name: 'Light',
		},
		{
			value: 'dark',
			name: 'Dark',
		},
		{
			value: 'cosmic',
			name: 'Cosmic',
		},
		{
			value: 'corporate',
			name: 'Corporate',
		},
	];

	currentTheme = 'default';

	constructor(
		private themeService: NbThemeService
	) { }

	toggleTheme() {
		this.themeService.changeTheme(this.currentTheme);
	}
}
