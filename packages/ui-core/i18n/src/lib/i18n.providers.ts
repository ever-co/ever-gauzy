import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideTranslateService, RootTranslateServiceConfig } from '@ngx-translate/core';
import { provideTranslateHttpLoader, HttpLoaderOptions, DEFAULT_HTTP_LOADER_OPTIONS } from './translate-http-loader';

/**
 * Configuration options for the I18n providers.
 *
 * Uses ngx-translate v17 naming conventions:
 * - `lang` — the initial language to activate on startup
 * - `fallbackLang` — the language used when a translation key is missing
 * - `extend` — whether child services inherit and extend parent translations
 *
 * **Important:** `lang` and `fallbackLang` are intentionally NOT set by default.
 * Setting them in the provider config causes `TranslateService` to eagerly load
 * translations during DI initialization. In apps that register HTTP interceptors
 * depending on `TranslateService` (e.g. `LanguageInterceptor`), this creates an
 * `NG0200` circular dependency:
 *   TranslateService → TranslateLoader → HttpClient → LanguageInterceptor → TranslateService
 *
 * Instead, set the fallback/default language imperatively after bootstrap
 * (e.g. via `translateService.setFallbackLang()` or an `APP_INITIALIZER`).
 * Only pass `lang`/`fallbackLang` here if your app has NO such interceptors.
 */
export interface I18nProviderOptions {
	/** The initial language to activate on startup. Maps to ngx-translate v17 `lang`. */
	lang?: string;
	/** The fallback language when a translation is not found. Maps to ngx-translate v17 `fallbackLang`. */
	fallbackLang?: string;
	/** Whether child translate services should extend parent translations. Default: false. */
	extend?: boolean;
	/** HTTP loader options for translation files. */
	loader?: HttpLoaderOptions;
	/** Custom loader provider (single Provider). If provided, overrides the HTTP loader. */
	customLoader?: ReturnType<typeof provideTranslateHttpLoader>;
}

/**
 * Default I18n provider options.
 *
 * `lang` and `fallbackLang` are intentionally omitted to avoid NG0200 circular
 * dependency in apps with HTTP interceptors that depend on TranslateService.
 */
export const DEFAULT_I18N_OPTIONS: Required<Omit<I18nProviderOptions, 'customLoader' | 'lang' | 'fallbackLang'>> = {
	extend: false,
	loader: DEFAULT_HTTP_LOADER_OPTIONS
};

/**
 * Provides I18n translation services for standalone Angular applications.
 * This is the recommended approach for Angular 17+ standalone applications.
 *
 * Uses the ngx-translate v17 standalone `provideTranslateService()` API internally.
 * Deprecated options (`useDefaultLang`, `defaultLanguage`) are NOT used.
 *
 * @param options Optional configuration for the I18n provider.
 * @returns Environment providers for the I18n services.
 *
 * @example
 * ```typescript
 * // In app.config.ts (app has no LanguageInterceptor)
 * import { provideI18n } from '@gauzy/ui-core/i18n';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideHttpClient(),
 *     provideI18n({
 *       fallbackLang: 'en',
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
 * // Simple usage with defaults (language set imperatively after bootstrap)
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

	// Build the translate service config, only including lang/fallbackLang
	// when explicitly provided to avoid eager translation loading (NG0200).
	const translateConfig: RootTranslateServiceConfig = {
		extend: config.extend,
		loader: config.customLoader ?? provideTranslateHttpLoader(config.loader)
	};

	if (config.lang) {
		translateConfig.lang = config.lang;
	}

	if (config.fallbackLang) {
		translateConfig.fallbackLang = config.fallbackLang;
	}

	// I18nService uses providedIn: 'root' — no explicit registration needed.
	return makeEnvironmentProviders([
		// Configure ngx-translate with the v17 standalone API
		provideTranslateService(translateConfig)
	]);
}

/**
 * Re-export provideTranslateService from @ngx-translate/core for convenience.
 * This allows consumers to use the raw ngx-translate API if needed.
 */
export { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
