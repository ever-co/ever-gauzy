import { Component } from '@angular/core';
import {
	NbThemeService,
	NbLayoutDirectionService,
	NbLayoutDirection
} from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ngx-theme-settings',
	styleUrls: ['./theme-settings.component.scss'],
	templateUrl: './theme-settings.component.html'
})
export class ThemeSettingsComponent {
	themes = [
		{
			value: 'default',
			name: 'Light'
		},
		{
			value: 'dark',
			name: 'Dark'
		},
		{
			value: 'cosmic',
			name: 'Cosmic'
		},
		{
			value: 'corporate',
			name: 'Corporate'
		}
	];

	languages = [
		{
			value: 'en',
			name: 'English'
		},
		{
			value: 'bg',
			name: 'Bulgarian'
		},
		{
			value: 'he',
			name: 'Hebrew'
		},
		{
			value: 'ru',
			name: 'Russian'
		}
	];

	currentTheme = 'default';
	currentLang = 'en';

	constructor(
		private themeService: NbThemeService,
		private translate: TranslateService,
		private directionService: NbLayoutDirectionService
	) {
		translate.addLangs(['en', 'bg', 'he', 'ru']);
		translate.setDefaultLang('en');

		const browserLang = translate.getBrowserLang();
		translate.use(browserLang.match(/en|bg|he|ru/) ? browserLang : 'en');

		this.currentLang = translate.defaultLang;
	}

	toggleTheme() {
		this.themeService.changeTheme(this.currentTheme);
	}

	switchLanguage() {
		this.translate.use(this.currentLang);

		if (this.currentLang === 'he') {
			this.directionService.setDirection(NbLayoutDirection.RTL);
		} else {
			this.directionService.setDirection(NbLayoutDirection.LTR);
		}
		this.translate.use(this.currentLang);
	}
}
