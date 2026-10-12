import { Subject } from 'rxjs';
import { applyPluginTranslations, IPluginTranslateService } from './plugin-ui.helper';

/**
 * Regression: a **module** plugin's `translations` were never merged into ngx-translate.
 *
 * `defineDeclarativePlugin` puts the merge inside the `bootstrap` callback, but
 * `PluginUiModule.bootstrapDeclarativePlugins()` only runs `bootstrap` for plugins with no
 * `module`/`loadModule`, and `applyDeclarativeRegistrations()` — the entry point a module plugin
 * calls from `ngOnPluginBootstrap` — did routes/nav/tabs/extensions/widgets and nothing else.
 * `@gauzy/plugin-docs-ui` ships `translations: { en }` + `translationNamespace: 'DOCS'` behind a
 * `module`, so every `DOCS.*` key in the Documents hub rendered as its raw key.
 *
 * These cover the seam itself: namespacing, the additive-only merge, and — the part that made the
 * bug invisible — the load-order rule that a merge must not fire before core's bundle exists.
 */

/** Minimal `IPluginTranslateService` double: a bundle per language plus a `onLangChange` subject. */
function createTranslateServiceStub(bundles: Record<string, Record<string, any>>, currentLang = 'en') {
	const onLangChange = new Subject<{ lang: string }>();
	const setTranslation = jest.fn((lang: string, translations: Record<string, any>, shouldMerge?: boolean) => {
		bundles[lang] = shouldMerge ? { ...(bundles[lang] ?? {}), ...translations } : translations;
	});

	const service: IPluginTranslateService = {
		setTranslation,
		getTranslations: (lang: string) => bundles[lang],
		getCurrentLang: () => currentLang,
		getFallbackLang: () => 'en',
		instant: (key: string) => key,
		stream: () => new Subject<string>().asObservable(),
		onLangChange: onLangChange.asObservable()
	};

	return { service, setTranslation, onLangChange, bundles };
}

const DEFINITION = {
	translationNamespace: 'DOCS',
	translations: { en: { TITLE: 'Documents', TREE: { NEW: 'New' } } }
};

describe('applyPluginTranslations', () => {
	it('merges the bundle under the declared namespace', () => {
		const { service, setTranslation } = createTranslateServiceStub({ en: { MENU: { HOME: 'Home' } } });

		applyPluginTranslations(DEFINITION, service);

		expect(setTranslation).toHaveBeenCalledTimes(1);
		const [lang, merged, shouldMerge] = setTranslation.mock.calls[0];
		expect(lang).toBe('en');
		expect(shouldMerge).toBe(true);
		// `DOCS.TREE.NEW` must resolve — i.e. en.json IS the namespace body, not a flat key.
		expect(merged).toEqual({ DOCS: { TITLE: 'Documents', TREE: { NEW: 'New' } } });
	});

	it('never overrides a key the host already has', () => {
		const { service, setTranslation } = createTranslateServiceStub({
			en: { DOCS: { TITLE: 'Core wins' } }
		});

		applyPluginTranslations(DEFINITION, service);

		// TITLE is dropped (core already owns it); only the genuinely new subtree is merged.
		expect(setTranslation.mock.calls[0][1]).toEqual({ DOCS: { TREE: { NEW: 'New' } } });
	});

	it('does not merge before the core bundle has loaded, then merges when it has', () => {
		// An empty bundle means core's HTTP load has not resolved. Merging now would mark the
		// language "available" in TranslateStore and make ngx-translate skip that load entirely.
		const stub = createTranslateServiceStub({ en: {} });

		applyPluginTranslations(DEFINITION, stub.service);
		expect(stub.setTranslation).not.toHaveBeenCalled();

		stub.bundles['en'] = { MENU: { HOME: 'Home' } };
		stub.onLangChange.next({ lang: 'en' });

		expect(stub.setTranslation).toHaveBeenCalledTimes(1);
		expect(stub.setTranslation.mock.calls[0][1]).toEqual({ DOCS: DEFINITION.translations.en });
	});

	it('falls back to the fallback language bundle for a language the plugin does not ship', () => {
		const stub = createTranslateServiceStub({ en: { MENU: {} }, fr: { MENU: {} } }, 'fr');

		applyPluginTranslations(DEFINITION, stub.service);

		// The plugin ships English only; a French user gets English rather than raw keys.
		expect(stub.setTranslation.mock.calls[0][0]).toBe('fr');
		expect(stub.setTranslation.mock.calls[0][1]).toEqual({ DOCS: DEFINITION.translations.en });
	});

	it('keeps merging as the user switches language', () => {
		const stub = createTranslateServiceStub({ en: { MENU: {} }, de: { MENU: {} } });

		applyPluginTranslations(DEFINITION, stub.service);
		stub.onLangChange.next({ lang: 'de' });

		expect(stub.setTranslation.mock.calls.map((call) => call[0])).toEqual(['en', 'de']);
	});

	it('is a no-op without a translate service, so a test harness can still boot the module', () => {
		expect(applyPluginTranslations(DEFINITION, null)).toBeUndefined();
		expect(applyPluginTranslations(DEFINITION, undefined)).toBeUndefined();
	});

	it('is a no-op for a plugin that ships no translations', () => {
		const { service, setTranslation } = createTranslateServiceStub({ en: { MENU: {} } });

		expect(applyPluginTranslations({ translations: undefined }, service)).toBeUndefined();
		expect(setTranslation).not.toHaveBeenCalled();
	});
});
