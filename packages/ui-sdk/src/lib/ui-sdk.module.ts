import { ModuleWithProviders, NgModule } from '@angular/core';
import { LanguagesEnum } from '@gauzy/contracts';
import { I18nTranslateModule, I18nTranslateService } from './i18n';
import { CommonModule } from './common';

@NgModule({
	declarations: [],
	imports: [I18nTranslateModule.forRoot(), CommonModule],
	exports: []
})
export class UiSdkModule {
	/**
	 * Constructs a new instance of the class and initializes the available languages.
	 *
	 * @param {I18nTranslateService} _i18nTranslateService - The I18nTranslateService dependency.
	 */
	constructor(protected readonly _i18nTranslateService: I18nTranslateService) {
		const availableLanguages = Object.values(LanguagesEnum);
		_i18nTranslateService.setAvailableLanguags(availableLanguages);
	}

	/**
	 * Returns a ModuleWithProviders object for the UiSdkModule.
	 *
	 * @return {ModuleWithProviders<UiSdkModule>} The ModuleWithProviders object containing the UiSdkModule and an empty providers array.
	 */
	static forRoot(): ModuleWithProviders<UiSdkModule> {
		return {
			ngModule: UiSdkModule,
			providers: []
		};
	}
}
