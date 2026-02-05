import { inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Global type alias for translation parameters.
 * Using Object to match ngx-translate's signature and allow interfaces without string index signatures.
 */
export type TranslateParams = Object;

/**
 * Base component class that provides translation utilities.
 * Extend this class to easily access translation methods in your components.
 *
 * Supports both constructor injection (NgModule) and inject() (Standalone).
 *
 * @example
 * ```typescript
 * // NgModule-based component (constructor injection)
 * @Component({
 *   selector: 'app-my-component',
 *   template: `<h1>{{ getTranslation('COMMON.TITLE') }}</h1>`
 * })
 * export class MyComponent extends TranslationBaseComponent {
 *   constructor(translateService: TranslateService) {
 *     super(translateService);
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Standalone component (inject() pattern)
 * @Component({
 *   standalone: true,
 *   selector: 'app-my-component',
 *   template: `<h1>{{ getTranslation('COMMON.TITLE') }}</h1>`
 * })
 * export class MyComponent extends TranslationBaseComponent {
 *   constructor() {
 *     super(); // Uses inject() internally
 *   }
 * }
 * ```
 */
export abstract class TranslationBaseComponent {
	/**
	 * The TranslateService instance.
	 * Made protected so subclasses can access it directly if needed.
	 */
	protected readonly translateService: TranslateService;

	/**
	 * Creates a TranslationBaseComponent.
	 * @param translateService Optional TranslateService instance. If not provided, uses inject().
	 */
	constructor(translateService?: TranslateService) {
		this.translateService = translateService ?? inject(TranslateService);
	}

	// ==================== Language Utilities ====================

	/**
	 * Gets the current language code.
	 * Uses the new ngx-translate v17 API.
	 * @returns The current language code (e.g., 'en', 'fr') or undefined if not set.
	 */
	getCurrentLang(): string | undefined {
		return this.translateService.getCurrentLang();
	}

	/**
	 * Gets the fallback language code.
	 * Uses the new ngx-translate v17 API.
	 * @returns The fallback language code or undefined if not set.
	 */
	getFallbackLang(): string | undefined {
		return this.translateService.getFallbackLang();
	}

	/**
	 * Gets an array of available languages.
	 * @returns Array of language codes that have been loaded.
	 */
	get availableLangs(): readonly string[] {
		return this.translateService.getLangs();
	}

	/**
	 * Observable that emits the current language code whenever it changes.
	 * @returns Observable of language code strings.
	 */
	get onLangChange$(): Observable<string> {
		return this.translateService.onLangChange.pipe(map((event) => event.lang));
	}

	// ==================== Translation Methods ====================

	/**
	 * Get translation synchronously for the given key.
	 * Uses `instant()` which returns immediately from cached translations.
	 *
	 * **Note:** This method returns synchronously. If translations are not yet loaded,
	 * it will return the key itself (or fallback). For cases where translations may
	 * not be loaded yet, use `getTranslationAsync()` or `getTranslation$()` instead.
	 *
	 * @param key The translation key.
	 * @param params Optional parameters to be interpolated into the translation.
	 * @returns The translated string (or the key if not found/not loaded yet).
	 */
	getTranslation(key: string, params?: TranslateParams): string {
		return this.translateService.instant(key, params);
	}

	/**
	 * Get translation asynchronously for the given key.
	 * Useful when translations may not be loaded yet.
	 *
	 * @param key The translation key.
	 * @param params Optional parameters to be interpolated into the translation.
	 * @returns A promise that resolves to the translated string.
	 */
	async getTranslationAsync(key: string, params?: TranslateParams): Promise<string> {
		return firstValueFrom(this.translateService.get(key, params));
	}

	/**
	 * Get translation as an observable for the given key.
	 * The observable will emit a new value whenever the language changes.
	 *
	 * @param key The translation key.
	 * @param params Optional parameters to be interpolated into the translation.
	 * @returns An observable that emits the translated string.
	 */
	getTranslation$(key: string, params?: TranslateParams): Observable<string> {
		return this.translateService.stream(key, params);
	}

	/**
	 * Get multiple translations at once synchronously.
	 *
	 * @param keys Array of translation keys.
	 * @param params Optional parameters to be interpolated into all translations.
	 * @returns Object mapping keys to their translated values.
	 */
	getTranslations(keys: string[], params?: TranslateParams): Record<string, string> {
		return this.translateService.instant(keys, params) as Record<string, string>;
	}

	/**
	 * Get multiple translations at once asynchronously.
	 *
	 * @param keys Array of translation keys.
	 * @param params Optional parameters to be interpolated into all translations.
	 * @returns Promise resolving to object mapping keys to their translated values.
	 */
	async getTranslationsAsync(keys: string[], params?: TranslateParams): Promise<Record<string, string>> {
		return firstValueFrom(this.translateService.get(keys, params));
	}

	// ==================== Language Control ====================

	/**
	 * Switch the current language.
	 *
	 * @param lang The language code to switch to.
	 * @returns Promise that resolves when the language has been loaded.
	 */
	async switchLanguage(lang: string): Promise<void> {
		await firstValueFrom(this.translateService.use(lang));
	}

	/**
	 * Switch the current language (observable version).
	 *
	 * @param lang The language code to switch to.
	 * @returns Observable that emits when the language has been loaded.
	 */
	switchLanguage$(lang: string): Observable<unknown> {
		return this.translateService.use(lang);
	}
}
