import { TranslateService } from '@ngx-translate/core';
import { LanguagesEnum } from '@gauzy/contracts';
import { TranslationBaseComponent } from './translation-base.component';

/**
 * Extend this class for public components which do not
 * have theme-settings.component in the layout
 */
export abstract class SetLanguageBaseComponent extends TranslationBaseComponent {
	constructor(public readonly translateService: TranslateService) {
		super(translateService);

		// Gets default available enum languages, e.g., "en", "bg", "he", "ru"
		const availableLanguages = Object.values(LanguagesEnum);

		this.translateService.addLangs(availableLanguages);
		this.translateService.setDefaultLang(LanguagesEnum.ENGLISH);

		const browserLang = this.translateService.getBrowserLang();

		// Create a regex pattern from the available languages
		const pattern = new RegExp(`^(${availableLanguages.join('|')})$`);
		this.translateService.use(pattern.test(browserLang) ? browserLang : LanguagesEnum.ENGLISH);
	}
}
