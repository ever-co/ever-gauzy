import { Component } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
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

	languages = { en: 'English', bg: 'Bulgarian', he: 'Hebrew', ru: 'Russian' };

	constructor(
		private themeService: NbThemeService,
		public translate: TranslateService
	) {
		translate.addLangs(['en', 'bg', 'he', 'ru']);
		translate.setDefaultLang('en');

		const browserLang = translate.getBrowserLang();
		translate.use(browserLang.match(/en|bg|he|ru/) ? browserLang : 'en');
	 }

	toggleTheme() {
		this.themeService.changeTheme(this.currentTheme);
	}
	switchLanguage(language: string) {

		this.translate.use(language);
	}

}
