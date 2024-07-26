import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { LanguagesEnum } from '@gauzy/contracts';

@Injectable({ providedIn: 'root' })
export class I18nService {
	private _availableLanguages: LanguagesEnum[] = [];
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
	setDefaultLang(lang: string): void {
		this._translateService.setDefaultLang(lang);
	}

	/**
	 * Sets the language to use
	 * @param lang The language code to set as the default language.
	 */
	setLanguage(lang: string): void {
		this._translateService.use(lang);
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
