import { Injectable } from '@angular/core';
import { TranslateService, LangChangeEvent } from '@ngx-translate/core';
import { LanguagesEnum } from '@gauzy/contracts';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class I18nService {
	private _availableLanguages: LanguagesEnum[] = [];
	get availableLanguages(): LanguagesEnum[] {
		return this._availableLanguages;
	}

	constructor(public readonly _translateService: TranslateService) {}

	/**
	 * Sets the default language to use as a fallback
	 * @param lang The language code to set as the default language.
	 */
	setDefaultLang(lang: string): void {
		this._translateService.setDefaultLang(lang);
	}

	/**
	 * Sets the available languages for the application
	 * @param languages An array of language codes to set as available languages.
	 */
	setAvailableLanguags(languages: LanguagesEnum[]): void {
		this._availableLanguages = languages;
	}

	/**
	 * Returns the language code name from the browser, e.g., "de"
	 * @returns The browser language code.
	 */
	getBrowserLang(): string | undefined {
		return this._translateService.getBrowserLang();
	}

	/**
	 * Changes the language currently used
	 * @param lang The language code to switch to.
	 */
	use(lang: string): void {
		this._translateService.use(lang);
	}

	/**
	 * Returns an observable for language change events
	 * @returns An observable that emits events when the language changes.
	 */
	onLangChange(): Observable<LangChangeEvent> {
		return this._translateService.onLangChange;
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
