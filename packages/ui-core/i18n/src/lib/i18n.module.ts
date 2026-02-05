import { ModuleWithProviders, NgModule } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { I18nService } from './i18n.service';
import { provideTranslateHttpLoader } from './translate-http-loader';

/**
 * I18nModule provides internationalization support for Angular applications.
 *
 * This module wraps @ngx-translate and provides a consistent API for translation services.
 *
 * @example
 * ```typescript
 * // In your root AppModule (NgModule-based apps)
 * import { I18nModule } from '@gauzy/ui-core/i18n';
 *
 * @NgModule({
 *   imports: [I18nModule.forRoot()]
 * })
 * export class AppModule {}
 * ```
 *
 * @example
 * ```typescript
 * // In lazy-loaded feature modules
 * import { I18nModule } from '@gauzy/ui-core/i18n';
 *
 * @NgModule({
 *   imports: [I18nModule.forChild()]
 * })
 * export class FeatureModule {}
 * ```
 *
 * @note For standalone Angular 17+ applications, use `provideI18n()` instead.
 * @see {@link provideI18n} for standalone applications
 */
@NgModule({
	exports: [TranslateModule]
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
			providers: [
				I18nService,
				...(TranslateModule.forRoot({
					loader: provideTranslateHttpLoader()
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
