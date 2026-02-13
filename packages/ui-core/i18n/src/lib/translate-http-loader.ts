import { Provider } from '@angular/core';
import { provideTranslateHttpLoader as ngxProvideTranslateHttpLoader } from '@ngx-translate/http-loader';

/**
 * Default configuration options for the HTTP loader.
 */
export interface HttpLoaderOptions {
	/** The prefix path for translation files. Default: './assets/i18n/' */
	prefix?: string;
	/** The suffix/extension for translation files. Default: '.json' */
	suffix?: string;
}

/**
 * Default HTTP loader options.
 */
export const DEFAULT_HTTP_LOADER_OPTIONS: Required<HttpLoaderOptions> = {
	prefix: './assets/i18n/',
	suffix: '.json'
};

/**
 * Provides the TranslateHttpLoader for Angular applications.
 * This is the recommended approach for Angular 17+ applications using @ngx-translate/http-loader v17+.
 *
 * In v17, the TranslateHttpLoader uses dependency injection internally,
 * so configuration is done via providers rather than constructor arguments.
 *
 * Returns a single `Provider` (which Angular DI treats as a flat array of providers
 * containing the HTTP loader config token and the `TranslateLoader` class provider).
 * This aligns with the `TranslateProviders.loader` type expected by
 * `TranslateModule.forRoot()` and `provideTranslateService()` in ngx-translate v17.
 *
 * @param options Optional configuration for prefix and suffix.
 * @returns A single Provider compatible with `TranslateProviders.loader`.
 *
 * @example
 * ```typescript
 * // For standalone apps (app.config.ts)
 * import { provideTranslateHttpLoader } from '@gauzy/ui-core/i18n';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideHttpClient(),
 *     provideTranslateService({
 *       fallbackLang: 'en',
 *       loader: provideTranslateHttpLoader()
 *     })
 *   ]
 * };
 * ```
 *
 * @example
 * ```typescript
 * // For NgModule-based apps (recommended v17 pattern)
 * import { provideTranslateHttpLoader, TranslateModule } from '@gauzy/ui-core/i18n';
 *
 * @NgModule({
 *   imports: [
 *     TranslateModule.forRoot({
 *       fallbackLang: 'en',
 *       loader: provideTranslateHttpLoader()
 *     })
 *   ]
 * })
 * export class AppModule {}
 * ```
 */
export function provideTranslateHttpLoader(options?: HttpLoaderOptions): Provider {
	const { prefix, suffix } = { ...DEFAULT_HTTP_LOADER_OPTIONS, ...options };
	return ngxProvideTranslateHttpLoader({ prefix, suffix });
}
