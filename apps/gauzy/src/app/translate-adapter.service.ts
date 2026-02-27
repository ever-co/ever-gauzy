import { inject, Injectable } from '@angular/core';
import { TranslateService, TranslateStore } from '@ngx-translate/core';
import type { IPluginTranslateService } from '@gauzy/plugin-ui';

/**
 * Adapter that bridges `@ngx-translate/core`'s `TranslateService` to
 * the `IPluginTranslateService` interface expected by `PluginUiModule`.
 *
 * `TranslateService` satisfies most of the interface but does not expose
 * `getTranslations(lang)` directly — that method lives on `TranslateStore`.
 * This adapter delegates each method to the correct underlying service.
 */
@Injectable({ providedIn: 'root' })
export class TranslateAdapterService implements IPluginTranslateService {
	private readonly _translate = inject(TranslateService);
	private readonly _store = inject(TranslateStore);

	/** Merges translations for a given language into the global namespace. */
	setTranslation(lang: string, translations: Record<string, any>, shouldMerge?: boolean): void {
		this._translate.setTranslation(lang, translations, shouldMerge);
	}

	/**
	 * Returns the compiled translation object for a given language,
	 * or `undefined` if the language has not been loaded yet.
	 * Delegates to `TranslateStore.getTranslations()` which owns the store.
	 */
	getTranslations(lang: string): Readonly<Record<string, any>> | undefined {
		return this._store.getTranslations(lang) as Readonly<Record<string, any>> | undefined;
	}

	/** Returns the currently active language code. */
	getCurrentLang(): string {
		return this._translate.getCurrentLang();
	}

	/** Returns the configured fallback language code, or `null` if none is set. */
	getFallbackLang(): string | null {
		return this._translate.getFallbackLang();
	}
}
