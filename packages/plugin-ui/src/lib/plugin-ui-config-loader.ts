import { PluginUiConfig, collectPluginIds, flattenPlugins } from './plugin-ui.types';
import { setPluginUiConfig } from './plugin-ui.loader';

/**
 * Config loader function type. Applications provide this to load their
 * own UI configuration (e.g. from a compile-time module or runtime endpoint).
 */
export type PluginUiConfigLoader = () => Promise<{ uiPluginConfig: PluginUiConfig }>;

/**
 * Loads, validates, and stores the application UI configuration,
 * making it available via `getPluginUiConfig()` from `@gauzy/plugin-ui`.
 *
 * Must be awaited **before** `platformBrowser().bootstrapModule()`
 * so that every Angular module, service, and component can safely
 * call `getPluginUiConfig()` during initialization.
 *
 * The config source is supplied by the host application (e.g. a compile-time
 * TypeScript module or a JSON endpoint), keeping the door open for runtime
 * sources without changing the plugin-ui package.
 *
 * @param configLoader Async function that returns the application's UI config.
 * @throws If the configuration is structurally invalid.
 *
 * @example
 * ```ts
 * loadPluginUiConfig(() => import('./app/plugin-ui.config'))
 *   .then(() => platformBrowser().bootstrapModule(AppBootstrapModule))
 *   .catch((err) => console.error(err));
 * ```
 */
export async function loadPluginUiConfig(configLoader: PluginUiConfigLoader): Promise<void> {
	const { uiPluginConfig } = await configLoader();

	// ── Validate plugins ────────────────────────────────────
	if (!uiPluginConfig?.plugins || !Array.isArray(uiPluginConfig.plugins)) {
		throw new Error('[PluginUiConfig] Invalid configuration: "plugins" must be an array.');
	}

	const ids = collectPluginIds(uiPluginConfig.plugins);
	const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
	if (duplicates.length > 0) {
		throw new Error(`[PluginUiConfig] Duplicate plugin id(s) detected: ${duplicates.join(', ')}`);
	}

	// ── Validate i18n ───────────────────────────────────────
	if (!uiPluginConfig.defaultLanguage) {
		throw new Error('[PluginUiConfig] "defaultLanguage" is required.');
	}

	if (!Array.isArray(uiPluginConfig.availableLanguages) || uiPluginConfig.availableLanguages.length === 0) {
		throw new Error('[PluginUiConfig] "availableLanguages" must be a non-empty array.');
	}

	if (!uiPluginConfig.availableLanguages.includes(uiPluginConfig.defaultLanguage)) {
		throw new Error(
			`[PluginUiConfig] "defaultLanguage" (${uiPluginConfig.defaultLanguage}) must be listed in "availableLanguages".`
		);
	}

	// ── Store (freeze + publish via library) ────────────────
	setPluginUiConfig(uiPluginConfig);

	// ── Log summary ─────────────────────────────────────────
	const flatPlugins = flattenPlugins(uiPluginConfig.plugins);
	const locations = [...new Set(flatPlugins.map((p) => p.location).filter(Boolean))];

	console.log(
		`[PluginUiConfig] Loaded — ` +
			`${uiPluginConfig.plugins.length} plugin(s) [${locations.join(', ') || 'none'}], ` +
			`${uiPluginConfig.availableLanguages.length} language(s), ` +
			`default: ${uiPluginConfig.defaultLanguage} / ${uiPluginConfig.defaultLocale}`
	);
}
