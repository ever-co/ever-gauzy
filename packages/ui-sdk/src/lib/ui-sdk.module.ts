import { NgModule } from '@angular/core';
import { LanguagesEnum } from '@gauzy/contracts';
import { I18nService, TranslateModule } from '@gauzy/ui-sdk/i18n';

@NgModule({
	imports: [TranslateModule.forRoot()]
})
export class UiSdkModule {
	constructor(protected readonly _i18nService: I18nService) {
		const availableLanguages = Object.values(LanguagesEnum);
		_i18nService.setAvailableLanguags(availableLanguages);
	}
}
