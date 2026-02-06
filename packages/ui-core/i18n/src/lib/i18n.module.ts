import { ModuleWithProviders, NgModule } from '@angular/core';
import { TranslateModule, TranslateModuleConfig } from '@ngx-translate/core';
import { I18nService } from './i18n.service';
import { provideTranslateHttpLoader } from './translate-http-loader';
import { getBrowserLanguage } from './utils/get-browser-language';

/**
 * `I18nModule` provides centralized internationalization support for Angular applications based on `@ngx-translate/core`.
 *
 * It streamlines the setup of translation services, standardizing the loader configuration while allowing flexibility
 * for customization. This module should be imported once in the root module using `forRoot()` and in feature modules
 * using `forChild()`.
 *
 * Usage:
 *
 * 1. **Root Module Integration:**
 *    Import `I18nModule.forRoot()` in your main application module (usually `AppModule`).
 *    You can optionally pass configuration to override defaults (e.g., custom loaders).
 *
 *    @example
 *    ```typescript
 *    // Basic Usage
 *    @NgModule({
 *      imports: [
 *        I18nModule.forRoot()
 *      ]
 *    })
 *    export class AppModule {}
 *    ```
 *
 *    @example
 *    ```typescript
 *    // Custom Configuration Usage
 *    @NgModule({
 *      imports: [
 *        I18nModule.forRoot({
 *           loader: {
 *             provide: TranslateLoader,
 *             useFactory: (http: HttpClient) => new TranslateHttpLoader(http, './assets/i18n/', '.json'),
 *             deps: [HttpClient]
 *           }
 *        })
 *      ]
 *    })
 *    export class AppModule {}
 *    ```
 *
 * 2. **Feature Module Integration:**
 *    Import `I18nModule.forChild()` in lazy-loaded modules to ensure they share the same translation
 *    service instance as the root.
 *
 *    @example
 *    ```typescript
 *    @NgModule({
 *      imports: [
 *        I18nModule.forChild()
 *      ]
 *    })
 *    export class FeatureModule {}
 *    ```
 *
 * @note For standalone component-based applications (Angular 17+), consider using `provideI18n()`
 * in your application config instead of importing this module.
 * @see {@link provideI18n}
 */
@NgModule({
	exports: [TranslateModule]
})
export class I18nModule {
	/**
	 * Returns a ModuleWithProviders object that configures I18nModule for the root module.
	 * Use this method in your root AppModule to initialize the translation services.
	 *
	 * @param {TranslateModuleConfig} config - Configuration for TranslateModule
	 * @return {ModuleWithProviders<I18nModule>} A ModuleWithProviders object with the I18nModule and its providers.
	 */
	static forRoot(config: TranslateModuleConfig = {}): ModuleWithProviders<I18nModule> {
		return {
			ngModule: I18nModule,
			providers: [
				I18nService,
				...(TranslateModule.forRoot({
					loader: provideTranslateHttpLoader(),
					fallbackLang: getBrowserLanguage(),
					...config
				}).providers ?? [])
			]
		};
	}

	/**
	 * Returns a ModuleWithProviders object for lazy-loaded child modules.
	 * Use this method in feature modules that need access to translation services.
	 *
	 * @return {ModuleWithProviders<I18nModule>} A ModuleWithProviders object for child modules.
	 */
	static forChild(): ModuleWithProviders<I18nChildModule> {
		return {
			ngModule: I18nChildModule,
			providers: []
		};
	}
}

/**
 * Child module for lazy-loaded feature modules.
 * This module imports TranslateModule.forChild() to share the root translate service.
 */
@NgModule({
	imports: [TranslateModule.forChild()],
	exports: [TranslateModule]
})
export class I18nChildModule {}
