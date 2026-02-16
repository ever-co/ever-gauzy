import { LanguagesEnum, WeekDaysEnum } from '@gauzy/contracts';
import { DayOfWeek, PluginUiConfig } from '@gauzy/plugin-ui';
import { JobsPlugin } from '@gauzy/plugin-jobs-ui';
import { JobEmployeePlugin } from '@gauzy/plugin-job-employee-ui';
import { JobMatchingPlugin } from '@gauzy/plugin-job-matching-ui';
import { JobSearchPlugin } from '@gauzy/plugin-job-search-ui';
import { JobProposalPlugin, JobProposalTemplatePlugin } from '@gauzy/plugin-job-proposal-ui';
import { dayOfWeekAsString } from '@gauzy/ui-core/shared';

/**
 * Application UI configuration.
 *
 * Single source of truth for supported languages / locales
 * and the list of active UI plugins.
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  Plugins can be flat or hierarchical. A parent plugin    │
 * │  (e.g. JobsPlugin) can have child plugins via `plugins`.  │
 * │  Use JobsPlugin.init({ plugins: [...] }) to customize.    │
 * └──────────────────────────────────────────────────────────┘
 */
export const uiPluginConfig: PluginUiConfig = {
	// ── Internationalization ───────────────────────────────
	defaultLanguage: LanguagesEnum.ENGLISH,
	defaultLocale: 'en-US',
	fallbackLocale: LanguagesEnum.ENGLISH,

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

	// Day of week the week starts on (0 = Sunday, 1 = Monday, …)
	startWeekOn: dayOfWeekAsString(WeekDaysEnum.MONDAY) as DayOfWeek,

	// ── Plugins ────────────────────────────────────────────
	plugins: [
		// Sales Plugins (Proposals under Sales)
		JobProposalPlugin,

		// Job Plugins
		JobsPlugin.init({
			plugins: [JobEmployeePlugin, JobMatchingPlugin, JobSearchPlugin, JobProposalTemplatePlugin]
		})
	]
};
