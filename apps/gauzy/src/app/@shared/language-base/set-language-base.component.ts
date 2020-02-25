import { TranslateService } from '@ngx-translate/core';

/**
 * Extend this class for public components which do not
 * have theme-settings.component in the layout
 */
export abstract class SetLanguageBaseComponent {
	constructor(public translateService: TranslateService) {
		this.translateService.addLangs(['en', 'bg', 'he', 'ru']);
		this.translateService.setDefaultLang('en');

		const browserLang = this.translateService.getBrowserLang();
		this.translateService.use(
			browserLang.match(/en|bg|he|ru/) ? browserLang : 'en'
		);
	}
}
