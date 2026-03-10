import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { IPluginTranslateService } from '../plugin-ui.helper';
import { PLUGIN_TRANSLATE_DELEGATE, PLUGIN_TRANSLATE_STORE_DELEGATE } from '../plugin-ui.helper';

/**
 * Adapter that bridges the host application's translate service to the
 * `IPluginTranslateService` interface expected by `PluginUiModule`.
 *
 * Uses `PLUGIN_TRANSLATE_DELEGATE` and `PLUGIN_TRANSLATE_STORE_DELEGATE` tokens
 * so that `@gauzy/plugin-ui` does not depend on `@ngx-translate/core` directly.
 * The host app provides:
 * ```typescript
 * { provide: PLUGIN_TRANSLATE_DELEGATE, useExisting: TranslateService },
 * { provide: PLUGIN_TRANSLATE_STORE_DELEGATE, useExisting: TranslateStore }
 * ```
 *
 * Provided via `PluginUiModule.init({ translateService: TranslateAdapterService })`.
 * Used internally by `defineDeclarativePlugin` to merge plugin translations.
 */
@Injectable({ providedIn: 'root' })
export class TranslateAdapterService implements IPluginTranslateService {
	private readonly _translate = inject(PLUGIN_TRANSLATE_DELEGATE);
	private readonly _store = inject(PLUGIN_TRANSLATE_STORE_DELEGATE);

	/** Merges translations for a given language into the global namespace. */
	setTranslation(lang: string, translations: Record<string, any>, shouldMerge?: boolean): void {
		this._translate.setTranslation(lang, translations, shouldMerge);
	}

	/**
	 * Returns the compiled translation object for a given language,
	 * or `undefined` if the language has not been loaded yet.
	 */
	getTranslations(lang: string): Readonly<Record<string, any>> | undefined {
		return this._store.getTranslations(lang);
	}

	/** Returns the currently active language code. */
	getCurrentLang(): string {
		return this._translate.getCurrentLang();
	}

	/** Returns the configured fallback language code, or `null` if none is set. */
	getFallbackLang(): string | null {
		return this._translate.getFallbackLang();
	}

	/** Synchronous translation lookup. */
	instant(key: string, params?: Record<string, unknown>): string {
		return this._translate.instant(key, params);
	}

	/** Reactive translation. Re-emits when language or translations change. */
	stream(key: string, params?: Record<string, unknown>): Observable<string> {
		return this._translate.stream(key, params);
	}

	/** Emits whenever the active language changes (after translations are loaded). */
	get onLangChange(): Observable<{ lang: string }> {
		return this._translate.onLangChange;
	}
}
