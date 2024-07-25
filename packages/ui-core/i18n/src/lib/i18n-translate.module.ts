import { ModuleWithProviders, NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader, TranslateModuleConfig } from '@ngx-translate/core';
import { I18nTranslateService } from './i18n-translate.service';
import { HttpLoaderFactory } from './translate-http-loader';

@NgModule({
	imports: [
		TranslateModule.forRoot({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [TranslateModule]
})
export class I18nTranslateModule {
	/**
	 * Returns a ModuleWithProviders object that specifies the I18nTranslateModule and its providers.
	 *
	 * @return {ModuleWithProviders<I18nTranslateModule>} A ModuleWithProviders object with the I18nTranslateModule and its providers.
	 */
	static forRoot(): ModuleWithProviders<I18nTranslateModule> {
		return {
			ngModule: I18nTranslateModule,
			providers: [I18nTranslateService]
		};
	}

	/**
	 * @param config
	 * @returns ModuleWithProviders configuration for child modules
	 */
	static forChild(config?: TranslateModuleConfig): ModuleWithProviders<TranslateModule> {
		return TranslateModule.forChild(
			config || {
				loader: {
					provide: TranslateLoader,
					useFactory: HttpLoaderFactory,
					deps: [HttpClient]
				}
			}
		);
	}
}
