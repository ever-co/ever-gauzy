import { ModuleWithProviders, NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateModule as NgxTranslateModule, TranslateLoader, TranslateModuleConfig } from '@ngx-translate/core';
import { HttpLoaderFactory } from './translate-http-loader';

@NgModule({
	imports: [],
	exports: [NgxTranslateModule]
})
export class TranslateModule {
	/**
	 * @param config
	 * @returns ModuleWithProviders configuration for the root module
	 */
	static forRoot(config?: TranslateModuleConfig): ModuleWithProviders<NgxTranslateModule> {
		return NgxTranslateModule.forRoot(
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
	static forChild(config?: TranslateModuleConfig): ModuleWithProviders<NgxTranslateModule> {
		return NgxTranslateModule.forChild(
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
