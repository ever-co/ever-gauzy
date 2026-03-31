import { useMemo, useCallback } from 'react';
import { Observable, of } from 'rxjs';
import { PLUGIN_TRANSLATE_SERVICE, type IPluginTranslateService } from '@gauzy/plugin-ui';
import { useInjector } from './use-injector';
import { useObservable } from './use-observable';

/** No-op observable that never emits — used when translate service is unavailable. */
const EMPTY_LANG$: Observable<{ lang: string }> = of();
const EMPTY_STREAM$: Observable<string> = of();

/**
 * React hook for reactive translations.
 *
 * Returns `{ t, lang }` where:
 * - `t(key, params?)` — translates a key using the current language.
 * - `lang` — the current language code (re-renders on language change).
 *
 * Translations are resolved via `PLUGIN_TRANSLATE_SERVICE` (backed by
 * `@ngx-translate/core` under the hood). When the user switches language,
 * the component re-renders with updated translations automatically.
 *
 * @example Basic usage
 * ```tsx
 * function MyWidget() {
 *   const { t } = useTranslation();
 *   return <h1>{t('DASHBOARD_PAGE.TITLE')}</h1>;
 * }
 * ```
 *
 * @example With params
 * ```tsx
 * const { t } = useTranslation();
 * return <p>{t('GREETING', { name: 'Alice' })}</p>;
 * // en.json: { "GREETING": "Hello, {{name}}!" }
 * ```
 *
 * @example Single key (convenience overload)
 * ```tsx
 * const title = useTranslation('DASHBOARD_PAGE.TITLE');
 * return <h1>{title}</h1>;
 * ```
 */
export function useTranslation(): { t: (key: string, params?: Record<string, unknown>) => string; lang: string };
export function useTranslation(key: string, params?: Record<string, unknown>): string;
export function useTranslation(
	key?: string,
	params?: Record<string, unknown>
): string | { t: (key: string, params?: Record<string, unknown>) => string; lang: string } {
	const injector = useInjector();
	const translateService = useMemo<IPluginTranslateService | null>(() => {
		try {
			return injector.get(PLUGIN_TRANSLATE_SERVICE, null);
		} catch {
			return null;
		}
	}, [injector]);

	// Subscribe to language changes to trigger re-render on language switch.
	// Always called unconditionally (React rules of hooks).
	const langChange$ = useMemo(
		() => translateService?.onLangChange ?? EMPTY_LANG$,
		[translateService]
	);
	const langEvent = useObservable(langChange$);
	const lang = langEvent?.lang ?? translateService?.getCurrentLang() ?? '';

	// Subscribe to a single-key translation stream.
	// When no key is provided, uses a no-op stream (hook must always be called).
	const stream$ = useMemo(
		() => (key !== undefined && translateService ? translateService.stream(key, params) : EMPTY_STREAM$),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[translateService, key, JSON.stringify(params)]
	);
	const initialTranslation = key !== undefined && translateService ? translateService.instant(key, params) : undefined;
	const streamValue = useObservable(stream$, initialTranslation);

	// Multi-key `t()` function — re-created when language changes so
	// React components using `t()` in JSX re-render with updated text.
	const t = useCallback(
		(k: string, p?: Record<string, unknown>): string => {
			if (!translateService) return k;
			return translateService.instant(k, p);
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[translateService, lang]
	);

	// Single-key overload → return translated string
	if (key !== undefined) {
		return streamValue ?? key;
	}

	// Object overload → return { t, lang }
	return { t, lang };
}
