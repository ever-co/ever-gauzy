import { Observable } from 'rxjs';
import type { IPluginTranslateService } from './plugin-ui.helper';

/**
 * Wraps translation data in a namespace prefix.
 *
 * Given namespace `'MY_PLUGIN'` and data `{ TITLE: 'Hello' }`, produces
 * `{ MY_PLUGIN: { TITLE: 'Hello' } }`.
 *
 * @param namespace The namespace prefix (e.g. 'MY_PLUGIN', 'TIME_TRACKER').
 * @param data Raw translation data.
 * @returns Wrapped translation data with the namespace as root key.
 */
export function wrapTranslationsInNamespace(
	namespace: string,
	data: Record<string, any>
): Record<string, any> {
	return { [namespace]: data };
}

/**
 * Applies namespace wrapping to all languages in a plugin's translations map.
 *
 * @param namespace The namespace prefix.
 * @param translations Plugin translations keyed by language code.
 * @returns Namespaced translations keyed by language code.
 *
 * @example
 * ```ts
 * const raw = {
 *   en: { TITLE: 'Hello', DESC: 'World' },
 *   fr: { TITLE: 'Bonjour', DESC: 'Monde' }
 * };
 * const ns = namespaceTranslations('MY_PLUGIN', raw);
 * // => { en: { MY_PLUGIN: { TITLE: 'Hello', DESC: 'World' } }, fr: { MY_PLUGIN: { ... } } }
 * ```
 */
export function namespaceTranslations(
	namespace: string,
	translations: Record<string, Record<string, any>>
): Record<string, Record<string, any>> {
	const result: Record<string, Record<string, any>> = {};
	for (const [lang, data] of Object.entries(translations)) {
		result[lang] = wrapTranslationsInNamespace(namespace, data);
	}
	return result;
}

/**
 * A translate service wrapper that auto-prefixes keys with a plugin namespace.
 *
 * When a plugin declares `translationNamespace: 'MY_PLUGIN'`, it receives a
 * `NamespacedTranslateHelper` so that `instant('TITLE')` resolves to
 * `instant('MY_PLUGIN.TITLE')` — preventing key collisions with core or
 * other plugins' translations.
 *
 * @example
 * ```ts
 * // Plugin definition:
 * defineDeclarativePlugin('my-plugin', {
 *   translationNamespace: 'MY_PLUGIN',
 *   translations: {
 *     en: { TITLE: 'Dashboard', DESCRIPTION: 'Plugin dashboard' }
 *   }
 * });
 *
 * // At runtime, translations are stored as:
 * // { MY_PLUGIN: { TITLE: 'Dashboard', DESCRIPTION: 'Plugin dashboard' } }
 *
 * // Using the helper:
 * const ns = new NamespacedTranslateHelper(translateService, 'MY_PLUGIN');
 * ns.instant('TITLE');       // → resolves 'MY_PLUGIN.TITLE' → 'Dashboard'
 * ns.instant('DESCRIPTION'); // → resolves 'MY_PLUGIN.DESCRIPTION' → 'Plugin dashboard'
 *
 * // Full keys still work:
 * ns.instant('MY_PLUGIN.TITLE'); // → 'MY_PLUGIN.TITLE' (not double-prefixed)
 * ```
 */
export class NamespacedTranslateHelper implements IPluginTranslateService {
	constructor(
		private readonly _delegate: IPluginTranslateService,
		private readonly _namespace: string
	) {}

	/** The namespace prefix used by this helper. */
	get namespace(): string {
		return this._namespace;
	}

	/**
	 * Prefixes a key with the namespace, unless it already starts with the namespace.
	 */
	private _prefixKey(key: string): string {
		if (key.startsWith(this._namespace + '.')) {
			return key;
		}
		return `${this._namespace}.${key}`;
	}

	setTranslation(lang: string, translations: Record<string, any>, shouldMerge?: boolean): void {
		// Wrap translations under namespace before delegating.
		// Always force merge so that plugin translations are additive.
		// Even an explicit shouldMerge=false would replace the entire language
		// dictionary, wiping core and other plugins' translations.
		if (shouldMerge === false) {
			console.warn(
				`[NamespacedTranslateHelper] Ignoring shouldMerge=false for namespace '${this._namespace}' — ` +
					`plugin translations are always merged to prevent overwriting other plugins' translations.`
			);
		}
		const wrapped = wrapTranslationsInNamespace(this._namespace, translations);
		this._delegate.setTranslation(lang, wrapped, true);
	}

	getTranslations(lang: string): Readonly<Record<string, any>> | undefined {
		const all = this._delegate.getTranslations(lang);
		if (!all) return undefined;
		return all[this._namespace] as Readonly<Record<string, any>> | undefined;
	}

	getCurrentLang(): string {
		return this._delegate.getCurrentLang();
	}

	getFallbackLang(): string | null {
		return this._delegate.getFallbackLang();
	}

	instant(key: string, params?: Record<string, unknown>): string {
		return this._delegate.instant(this._prefixKey(key), params);
	}

	stream(key: string, params?: Record<string, unknown>): Observable<string> {
		return this._delegate.stream(this._prefixKey(key), params);
	}

	get onLangChange(): Observable<{ lang: string }> {
		return this._delegate.onLangChange;
	}
}

/**
 * Creates a namespaced translate helper for a plugin.
 *
 * @param translateService The root translate service.
 * @param namespace The plugin's translation namespace.
 * @returns A `NamespacedTranslateHelper` that auto-prefixes keys.
 */
export function createNamespacedTranslateHelper(
	translateService: IPluginTranslateService,
	namespace: string
): NamespacedTranslateHelper {
	return new NamespacedTranslateHelper(translateService, namespace);
}
