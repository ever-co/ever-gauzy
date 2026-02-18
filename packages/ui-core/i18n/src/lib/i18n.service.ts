import { inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { LanguagesEnum, NullableString } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';

/**
 * I18nService provides a wrapper around @ngx-translate's TranslateService
 * with additional functionality for managing language preferences.
 *
 * @example
 * ```typescript
 * // Inject using the modern inject() function
 * const i18nService = inject(I18nService);
 *
 * // Set the language
 * i18nService.setLanguage(LanguagesEnum.ENGLISH);
 *
 * // Get a translation synchronously
 * const text = i18nService.translate('COMMON.SAVE');
 *
 * // Get a translation asynchronously
 * const text = await i18nService.translateAsync('COMMON.SAVE');
 *
 * // Get the current language
 * const currentLang = i18nService.getCurrentLang();
 *
 * // Get the fallback language
 * const fallbackLang = i18nService.getFallbackLang();
 * ```
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
	private _availableLanguages: LanguagesEnum[] = [];
	private readonly _preferredLanguage$ = new BehaviorSubject<NullableString>(null);

	/**
	 * The underlying TranslateService from @ngx-translate/core.
	 * Use this for direct access to the ngx-translate API.
	 */
	readonly translateService = inject(TranslateService);

	/**
	 * Gets the preferred language as an observable.
	 * Emits only when the preferred language is set and changes.
	 * @returns An observable of the preferred language.
	 */
	get preferredLanguage$(): Observable<string> {
		return this._preferredLanguage$.asObservable().pipe(
			filter((preferredLanguage: string) => !!preferredLanguage),
			distinctUntilChange()
		);
	}

	/**
	 * Gets the current preferred language value.
	 * @returns The preferred language or null if not set.
	 */
	get preferredLanguage(): NullableString {
		return this._preferredLanguage$.getValue();
	}

	/**
	 * Gets the available languages for the application.
	 * @returns An array of available languages.
	 */
	get availableLanguages(): LanguagesEnum[] {
		return this._availableLanguages;
	}

	/**
	 * Gets the current language being used.
	 * Uses the new ngx-translate v17 API.
	 * @returns The current language code or undefined if not set.
	 */
	getCurrentLang(): string | undefined {
		return this.translateService.getCurrentLang();
	}

	/**
	 * Gets the fallback language (used when a translation is missing).
	 * Uses the new ngx-translate v17 API.
	 * @returns The fallback language code or undefined if not set.
	 */
	getFallbackLang(): string | undefined {
		return this.translateService.getFallbackLang();
	}

	/**
	 * Sets the fallback language (used when a translation is missing).
	 * Uses the new ngx-translate v17 API.
	 * @param lang The language code to set as the fallback language.
	 */
	setFallbackLang(lang: string): void {
		this.translateService.setFallbackLang(lang);
	}

	/**
	 * Sets the language to use and notifies all subscribers.
	 * @param lang The language code to set as the current language.
	 */
	setLanguage(lang: string): void {
		this.translateService.use(lang);
		this._preferredLanguage$.next(lang);
	}

	/**
	 * Sets the available languages for the application.
	 * @param languages An array of language codes to set as available languages.
	 */
	setAvailableLanguages(languages: LanguagesEnum[]): void {
		this._availableLanguages = languages;
	}

	/**
	 * Adds a language to the available languages list.
	 * @param language The language to add.
	 */
	addLanguage(language: LanguagesEnum): void {
		if (!this._availableLanguages.includes(language)) {
			this._availableLanguages.push(language);
		}
	}

	/**
	 * Removes a language from the available languages list.
	 * @param language The language to remove.
	 */
	removeLanguage(language: LanguagesEnum): void {
		this._availableLanguages = this._availableLanguages.filter((lang) => lang !== language);
	}

	/**
	 * Returns the language code from the browser, e.g., "de".
	 * @returns The browser language code or undefined if not available.
	 */
	getBrowserLang(): string | undefined {
		return this.translateService.getBrowserLang();
	}

	/**
	 * Returns a translation instantly from the internal state of loaded translations.
	 * All rules regarding the current language, the preferred language, or even fallback languages will be used.
	 * @param key The translation key or array of keys.
	 * @param params Optional parameters for interpolation.
	 * @returns The translated string.
	 */
	translate(key: string | string[], params?: Object): string {
		return this.translateService.instant(key, params);
	}

	/**
	 * Alias for translate() method.
	 * Returns a translation instantly from the internal state of loaded translations.
	 * @param key The translation key.
	 * @param params Optional parameters for interpolation.
	 * @returns The translated string.
	 */
	getTranslation(key: string, params?: Object): string {
		return this.translate(key, params);
	}

	/**
	 * Returns a translation asynchronously, waiting for the translation to be loaded.
	 * This is useful when translations may not be loaded yet.
	 * @param key The translation key or array of keys.
	 * @param params Optional parameters for interpolation.
	 * @returns A promise that resolves to the translated string.
	 */
	async translateAsync(key: string | string[], params?: Object): Promise<string> {
		return firstValueFrom(this.translateService.get(key, params));
	}

	/**
	 * Returns an observable for a translation.
	 * The observable will emit whenever the language changes.
	 * @param key The translation key or array of keys.
	 * @param params Optional parameters for interpolation.
	 * @returns An observable that emits the translated string.
	 */
	translate$(key: string | string[], params?: Object): Observable<string> {
		return this.translateService.stream(key, params);
	}
}
