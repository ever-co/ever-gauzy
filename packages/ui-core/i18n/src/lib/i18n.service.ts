import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { LanguagesEnum, NullableString } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';

@Injectable({ providedIn: 'root' })
export class I18nService {
	private _availableLanguages: LanguagesEnum[] = [];
	private _preferredLanguage$: BehaviorSubject<NullableString> = new BehaviorSubject<NullableString>(null);

	/**
	 * Getter for preferredLanguage$
	 * @returns An observable of the preferred language.
	 */
	get preferredLanguage$(): Observable<string> {
		return this._preferredLanguage$.asObservable().pipe(
			filter((preferredLanguage: string) => !!preferredLanguage),
			distinctUntilChange()
		);
	}

	/**
	 * Getter for preferredLanguage
	 * @returns The preferred language.
	 */
	get preferredLanguage(): NullableString {
		return this._preferredLanguage$.getValue();
	}

	/**
	 * Getter for availableLanguages
	 * @returns An array of available languages.
	 */
	get availableLanguages(): LanguagesEnum[] {
		return this._availableLanguages;
	}

	constructor(readonly _translateService: TranslateService) {}

	/**
	 * Sets the default language to use as a fallback
	 * @param lang The language code to set as the default language.
	 */
	setDefaultFallbackLang(lang: string): void {
		this._translateService.setDefaultLang(lang);
	}

	/**
	 * Sets the language to use and notify all subscribers
	 * @param lang The language code to set as the current language.
	 */
	setLanguage(lang: string): void {
		this._translateService.use(lang);
		this._preferredLanguage$.next(lang);
	}

	/**
	 * Sets the available languages for the application
	 * @param languages An array of language codes to set as available languages.
	 */
	setAvailableLanguages(languages: LanguagesEnum[]): void {
		this._availableLanguages = languages;
	}

	/**
	 * Function to add a language to the available languages list.
	 * @param language The language to add.
	 */
	addLanguage(language: LanguagesEnum): void {
		if (!this._availableLanguages.includes(language)) {
			this._availableLanguages.push(language);
		}
	}

	/**
	 * Function to remove a language from the available languages list.
	 * @param language The language to remove.
	 */
	removeLanguage(language: LanguagesEnum): void {
		this._availableLanguages = this._availableLanguages.filter((lang) => lang !== language);
	}

	/**
	 * Returns the language code name from the browser, e.g., "de"
	 * @returns The browser language code.
	 */
	getBrowserLang(): string | undefined {
		return this._translateService.getBrowserLang();
	}

	/**
	 * Retrieves a translation for a given prefix and optional parameters.
	 * @param prefix The prefix for the translation key.
	 * @param params Optional parameters for the translation.
	 * @returns The translated string.
	 */
	getTranslation(prefix: string, params?: Object): string {
		return this.translate(prefix, params);
	}

	/**
	 * Returns a translation instantly from the internal state of loaded translation.
	 * All rules regarding the current language, the preferred language, or even fallback languages will be used except any promise handling.
	 * @param key The translation key.
	 * @param params Optional parameters for the translation.
	 * @returns The translated string.
	 */
	translate(key: string | string[], params?: Object): string {
		return this._translateService.instant(key, params);
	}
}
