import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { LanguagesEnum } from '@gauzy/contracts';
import { provideTranslateHttpLoader, HttpLoaderOptions, DEFAULT_HTTP_LOADER_OPTIONS } from './translate-http-loader';
import { I18nService } from './i18n.service';

/**
 * Re-export provideTranslateService from @ngx-translate/core for convenience.
 * This allows consumers to use the raw ngx-translate API if needed.
 */
export { provideTranslateService, TranslateLoader } from '@ngx-translate/core';

/**
 * Configuration options for the I18n providers.
 */
export interface I18nProviderOptions {
	/** The default language to use. Default: 'en' */
	defaultLanguage?: string;
	/** The fallback language when a translation is not found. Default: 'en' */
	fallbackLanguage?: string;
	/** HTTP loader options for translation files. */
	loader?: HttpLoaderOptions;
	/** Custom loader provider. If provided, overrides the HTTP loader. */
	customLoader?: ReturnType<typeof provideTranslateHttpLoader>;
}

/**
 * Default I18n provider options.
 */
export const DEFAULT_I18N_OPTIONS: Required<Omit<I18nProviderOptions, 'customLoader'>> = {
	defaultLanguage: LanguagesEnum.ENGLISH,
	fallbackLanguage: LanguagesEnum.ENGLISH,
	loader: DEFAULT_HTTP_LOADER_OPTIONS
};

/**
 * Provides I18n translation services for standalone Angular applications.
 * This is the recommended approach for Angular 17+ standalone applications.
 *
 * @param options Optional configuration for the I18n provider.
 * @returns Environment providers for the I18n services.
 *
 * @example
 * ```typescript
 * // In app.config.ts
 * import { provideI18n } from '@gauzy/ui-core/i18n';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideHttpClient(),
 *     provideI18n({
 *       defaultLanguage: 'en',
 *       fallbackLanguage: 'en',
 *       loader: {
 *         prefix: './assets/i18n/',
 *         suffix: '.json'
 *       }
 *     })
 *   ]
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Simple usage with defaults
 * import { provideI18n } from '@gauzy/ui-core/i18n';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideHttpClient(),
 *     provideI18n()
 *   ]
 * };
 * ```
 */
export function provideI18n(options?: I18nProviderOptions): EnvironmentProviders {
	const config = { ...DEFAULT_I18N_OPTIONS, ...options };

	return makeEnvironmentProviders([
		// Provide the I18nService
		I18nService,
		// Configure ngx-translate with the new standalone API
		provideTranslateService({
			defaultLanguage: config.defaultLanguage,
			useDefaultLang: true,
			loader: config.customLoader ?? provideTranslateHttpLoader(config.loader)
		})
	]);
}
