import { ModuleWithProviders, NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { I18nService } from './i18n.service';
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
export class I18nModule {
	/**
	 * Returns a ModuleWithProviders object that specifies the I18nModule and its providers.
	 *
	 * @return {ModuleWithProviders<I18nModule>} A ModuleWithProviders object with the I18nModule and its providers.
	 */
	static forRoot(): ModuleWithProviders<I18nModule> {
		return {
			ngModule: I18nModule,
			providers: [I18nService]
		};
	}
}
