import { ModuleWithProviders, NgModule } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { I18nService } from './i18n.service';
import { provideTranslateHttpLoader } from './translate-http-loader';
import { getBrowserLanguage } from './utils/get-browser-language';

/**
 * `I18nModule` provides centralized internationalization support for Angular applications based on `@ngx-translate/core`.
 *
 * It streamlines the setup of translation services, standardizing the loader configuration.
 * This module should be imported once in the root module using `forRoot()`.
 *
 * Usage:
 *
 * 1. **Root Module Integration:**
 *    Import `I18nModule.forRoot()` in your main application module (usually `AppModule`).
 *
 *    @example
 *    ```typescript
 *    @NgModule({
 *      imports: [
 *        I18nModule.forRoot()
 *      ]
 *    })
 *    export class AppModule {}
 *    ```
 *
 * @note For standalone component-based applications (Angular 17+), consider using `provideI18n()`
 * in your application config instead of importing this module.
 * @see {@link provideI18n}
 */
@NgModule({
	imports: [
		TranslateModule.forRoot({
			loader: provideTranslateHttpLoader()
		})
	],
	exports: [TranslateModule],
	providers: [I18nService]
})
export class I18nModule {
	/**
	 * Returns a ModuleWithProviders object that configures I18nModule for the root module.
	 * Use this method in your root AppModule to initialize the translation services.
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
