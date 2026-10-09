import { type Injector } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

/**
 * Translate one key, falling back to the given English text.
 *
 * The fallback is not decoration: `TranslateService.instant()` echoes the key
 * back when the bundle for the active language has not loaded yet (the panel
 * can mount before the first HTTP load resolves), and a control labelled
 * `AI_ASSISTANT.HISTORY` is worse than one labelled `History`.
 */
export type ChatTranslate = (key: string, fallback: string) => string;

/**
 * Fallback-only translator, for the presentational components when they are
 * rendered outside the panel (the playground harness, tests, Storybook-style
 * usage) and no Angular injector is in reach.
 */
export const passthroughChatTranslate: ChatTranslate = (_key, fallback) => fallback;

/**
 * useChatTranslate
 *
 * Bridges ngx-translate into the React chat panel, mirroring what the
 * `| translate` pipe does on the Angular side: read the string now, and
 * re-render when the active language changes or a bundle finishes loading.
 *
 * The panel's chrome strings live in the CORE bundle under `AI_ASSISTANT.*`
 * — the one place all 14 locales exist — rather than in this plugin's own
 * `AI_CHAT_UI` namespace, which ships English only and falls every other
 * locale back to it.
 *
 * @param injector - The host Angular injector supplied by the React bridge.
 * @returns A `t(key, fallback)` function that is stable per language.
 */
export function useChatTranslate(injector: Injector): ChatTranslate {
	// `null` when the app was bootstrapped without TranslateModule (the
	// standalone playground harness): every lookup then yields its fallback.
	const translate = useMemo(() => injector.get(TranslateService, null), [injector]);

	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			if (!translate) return () => undefined;
			const langSub = translate.onLangChange.subscribe(() => onStoreChange());
			// Plugin bundles are merged with `setTranslation` AFTER the language
			// settles, which emits here and not on `onLangChange`.
			const translationSub = translate.onTranslationChange.subscribe(() => onStoreChange());
			return () => {
				langSub.unsubscribe();
				translationSub.unsubscribe();
			};
		},
		[translate]
	);

	// The snapshot has to change whenever the strings do, so it carries the
	// active language AND a counter-free marker of the last bundle merge: the
	// language alone is identical across a `setTranslation` for the same lang.
	const getSnapshot = useCallback(() => {
		if (!translate) return '';
		const lang = translate.getCurrentLang() ?? '';
		const probe = translate.instant('AI_ASSISTANT.TITLE');
		return `${lang}|${typeof probe === 'string' ? probe : ''}`;
	}, [translate]);

	const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

	return useCallback(
		(key: string, fallback: string) => {
			if (!translate) return fallback;
			const value = translate.instant(key);
			return typeof value === 'string' && value.length > 0 && value !== key ? value : fallback;
		},
		// `snapshot` is intentionally in the dependency list without being read:
		// a language switch must mint a new function identity so every consumer
		// re-renders with the new strings.
		[translate, snapshot]
	);
}
