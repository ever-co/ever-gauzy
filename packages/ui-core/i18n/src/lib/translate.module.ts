import { ModuleWithProviders, NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateModule as NgxTranslateModule, TranslateLoader } from '@ngx-translate/core';
import { I18nTranslateService } from './i18n-translate.service';
import { HttpLoaderFactory } from './translate-http-loader';

@NgModule({
	imports: [
		NgxTranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [NgxTranslateModule],
	providers: [I18nTranslateService]
})
export class TranslateModule {
	/**
	 * Returns a ModuleWithProviders object that specifies the TranslateModule and its providers.
	 *
	 * @return {ModuleWithProviders<TranslateModule>} A ModuleWithProviders object with the TranslateModule and its providers.
	 */
	static forRoot(): ModuleWithProviders<TranslateModule> {
		return {
			ngModule: TranslateModule,
			providers: [I18nTranslateService]
		};
	}
}
