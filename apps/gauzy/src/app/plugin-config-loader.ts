import { setAppUIConfig } from '@gauzy/ui-core/core';

/**
 * Loads, validates, and stores the application UI configuration,
 * making it available via `getAppUIConfig()` from `@gauzy/ui-core/core`.
 *
 * Must be awaited **before** `platformBrowser().bootstrapModule()`
 * so that every Angular module, service, and component can safely
 * call `getAppUIConfig()` during initialization.
 *
 * The config source is a compile-time TypeScript module today, but this
 * async boundary keeps the door open for runtime sources (e.g. a JSON
 * endpoint or feature-flag service) without changing the call-site.
 *
 * @throws If the configuration is structurally invalid.
 */
export async function loadAppUIConfig(): Promise<void> {
	const { uiPluginConfig } = await import('./ui-plugin.config');

	// ── Validate plugins ────────────────────────────────────
	if (!uiPluginConfig?.plugins || !Array.isArray(uiPluginConfig.plugins)) {
		throw new Error('[AppUIConfig] Invalid configuration: "plugins" must be an array.');
	}

	const ids = uiPluginConfig.plugins.map((p) => p.id);
	const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
	if (duplicates.length > 0) {
		throw new Error(`[AppUIConfig] Duplicate plugin id(s) detected: ${duplicates.join(', ')}`);
	}

	// ── Validate i18n ───────────────────────────────────────
	if (!uiPluginConfig.defaultLanguage) {
		throw new Error('[AppUIConfig] "defaultLanguage" is required.');
	}

	if (!Array.isArray(uiPluginConfig.availableLanguages) || uiPluginConfig.availableLanguages.length === 0) {
		throw new Error('[AppUIConfig] "availableLanguages" must be a non-empty array.');
	}

	if (!uiPluginConfig.availableLanguages.includes(uiPluginConfig.defaultLanguage)) {
		throw new Error(
			`[AppUIConfig] "defaultLanguage" (${uiPluginConfig.defaultLanguage}) must be listed in "availableLanguages".`
		);
	}

	// ── Store (freeze + publish via library) ────────────────
	setAppUIConfig(uiPluginConfig);

	// ── Log summary ─────────────────────────────────────────
	const locations = [...new Set(uiPluginConfig.plugins.map((p) => p.location).filter(Boolean))];

	console.log(
		`[AppUIConfig] Loaded — ` +
			`${uiPluginConfig.plugins.length} plugin(s) [${locations.join(', ') || 'none'}], ` +
			`${uiPluginConfig.availableLanguages.length} language(s), ` +
			`default: ${uiPluginConfig.defaultLanguage} / ${uiPluginConfig.defaultLocale}`
	);
}
