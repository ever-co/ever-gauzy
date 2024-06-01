import { NgModule } from '@angular/core';
import { I18nService } from '@gauzy/ui-sdk/i18n';
import { LanguagesEnum } from '@gauzy/contracts';

@NgModule({})
export class ThemeModule {
	constructor(protected readonly _i18nService: I18nService) {
		const availableLanguages = Object.values(LanguagesEnum);
		_i18nService.setAvailableLanguags(availableLanguages);
	}
}
