import { LanguagesEnum, WeekDaysEnum } from '@gauzy/contracts';
import { AppUIConfig } from '@gauzy/ui-core/core';
import { dayOfWeekAsString } from '@gauzy/ui-core/shared';
import { JobEmployeePlugin } from '@gauzy/plugin-job-employee-ui';
import { JobMatchingPlugin } from '@gauzy/plugin-job-matching-ui';
import { JobSearchPlugin } from '@gauzy/plugin-job-search-ui';
import { JobProposalTemplatePlugin } from '@gauzy/plugin-job-proposal-ui';

/**
 * Application UI configuration.
 *
 * Single source of truth for supported languages / locales
 * and the list of active UI plugins.
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  To include / exclude a feature, add or remove its       │
 * │  plugin from the `plugins` array below. Each plugin      │
 * │  self-registers its own routes AND sidebar menu items.    │
 * └──────────────────────────────────────────────────────────┘
 */
export const uiPluginConfig: AppUIConfig = {
	// ── Internationalization ───────────────────────────────
	defaultLanguage: LanguagesEnum.ENGLISH,
	defaultLocale: 'en-US',

	availableLanguages: [
		LanguagesEnum.ENGLISH,
		LanguagesEnum.FRENCH,
		LanguagesEnum.SPANISH,
		LanguagesEnum.GERMAN,
		LanguagesEnum.PORTUGUESE,
		LanguagesEnum.ITALIAN,
		LanguagesEnum.DUTCH,
		LanguagesEnum.POLISH,
		LanguagesEnum.RUSSIAN,
		LanguagesEnum.CHINESE,
		LanguagesEnum.ARABIC,
		LanguagesEnum.BULGARIAN,
		LanguagesEnum.HEBREW
	],

	availableLocales: [
		'en-US',
		'fr-FR',
		'es-ES',
		'de-DE',
		'pt-PT',
		'it-IT',
		'nl-NL',
		'pl-PL',
		'ru-RU',
		'zh-CN',
		'ar-SA',
		'bg-BG',
		'he-IL'
	],

	// Start of week for moment.js (0 = Sunday, 1 = Monday, …)
	week: { dow: dayOfWeekAsString(WeekDaysEnum.MONDAY) },

	// ── Plugins ────────────────────────────────────────────
	plugins: [
		// Job Plugins
		JobEmployeePlugin,
		JobMatchingPlugin,
		JobSearchPlugin,
		JobProposalTemplatePlugin
	]
};
