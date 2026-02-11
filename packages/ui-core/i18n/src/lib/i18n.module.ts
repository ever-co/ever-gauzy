import { ModuleWithProviders, NgModule } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from './translate-http-loader';

/**
 * `I18nModule` provides centralized internationalization support for Angular applications based on `@ngx-translate/core`.
 *
 * It streamlines the setup of translation services, standardizing the loader configuration.
 * This module should be imported once in the root module using `forRoot()`.
 *
 * `I18nService` is not listed here — it uses `providedIn: 'root'` and is
 * available globally without explicit registration.
 *
 * **Important:** `fallbackLang` and `lang` are intentionally NOT set in the provider
 * config. Setting them here causes `TranslateService` to eagerly load translations
 * during DI initialization, which triggers an `NG0200` circular dependency in apps
 * that have HTTP interceptors depending on `TranslateService` (e.g. `LanguageInterceptor`).
 * Instead, set the fallback/default language imperatively after bootstrap
 * (e.g. via `translateService.setFallbackLang()` or an `APP_INITIALIZER`).
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
	exports: [TranslateModule]
})
export class I18nModule {
	/**
	 * Configures I18nModule for the root module.
	 *
	 * The ngx-translate root providers (`TranslateService`, `TranslateStore`, HTTP loader)
	 * are registered via `TranslateModule.forRoot()` in the `@NgModule` decorator.
	 *
	 * @return {ModuleWithProviders<I18nModule>} A ModuleWithProviders object with the I18nModule.
	 */
	static forRoot(): ModuleWithProviders<I18nModule> {
		return {
			ngModule: I18nModule,
			providers: []
		};
	}
}
