import { ModuleWithProviders, NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader, TranslateModuleConfig } from '@ngx-translate/core';
import { HttpLoaderFactory } from './translate-http-loader';

@NgModule({
	imports: [TranslateModule],
	exports: [TranslateModule]
})
export class I18nTranslateModule {
	/**
	 * @param config
	 * @returns ModuleWithProviders configuration for the root module
	 */
	static forRoot(config?: TranslateModuleConfig): ModuleWithProviders<TranslateModule> {
		return TranslateModule.forRoot(
			config || {
				loader: {
					provide: TranslateLoader,
					useFactory: HttpLoaderFactory,
					deps: [HttpClient]
				}
			}
		);
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
