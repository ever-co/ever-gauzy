import { InjectionToken, Provider } from '@angular/core';

export type EverAppId = 'gauzy' | 'teams' | 'works' | 'platform' | 'demand' | 'rec' | 'traduora';

export interface IEverApp {
	id: EverAppId;
	shortName: string;
	logo: string;
	url: string;
	domain: string;
}

export const CURRENT_EVER_APP_ID: EverAppId = 'gauzy';

/**
 * The Ever apps the app switcher lists. Empty by default: the catalog (names, logos and web addresses of the Ever
 * apps) belongs to the Ever Platform UI module, `EVER_APP_CATALOG` of `@gauzy/plugin-ever-connect-ui`, which carries
 * it in its plugin `options` (`EVER_APPS_PLUGIN_OPTION`); the Gauzy web app reads it from the active UI plugins with
 * `everAppsFromPluginOptions`. A deployment without that module shows no switcher.
 */
export const EVER_APPS = new InjectionToken<ReadonlyArray<IEverApp>>('EVER_APPS', {
	providedIn: 'root',
	factory: (): ReadonlyArray<IEverApp> => []
});

/**
 * The provider of the app switcher's catalog, for a root module's `providers`.
 *
 * @param apps - The Ever apps to list, in their display order.
 */
export function provideEverApps(apps: ReadonlyArray<IEverApp>): Provider {
	return { provide: EVER_APPS, useValue: apps };
}

/**
 * The key of a UI plugin's `options` under which the plugin offers the app switcher's catalog. The root module then
 * needs no import of that plugin: removing the plugin from the plugin list removes the catalog with it.
 */
export const EVER_APPS_PLUGIN_OPTION = 'everApps';

/** The part of a UI plugin definition `everAppsFromPluginOptions` reads (structurally a `PluginUiDefinition`). */
export interface IEverAppsPluginSource {
	options?: Record<string, unknown>;
	plugins?: ReadonlyArray<IEverAppsPluginSource>;
}

/**
 * The app switcher's catalog offered by the active UI plugins: the first plugin (child plugins included, in list
 * order) whose `options[EVER_APPS_PLUGIN_OPTION]` is an array. None when no plugin offers one.
 *
 * @param plugins - The active UI plugins (`getPluginUiConfig().plugins`).
 */
export function everAppsFromPluginOptions(
	plugins: ReadonlyArray<IEverAppsPluginSource> | null | undefined
): ReadonlyArray<IEverApp> {
	for (const plugin of plugins ?? []) {
		const apps = plugin?.options?.[EVER_APPS_PLUGIN_OPTION];
		if (Array.isArray(apps)) {
			return apps as ReadonlyArray<IEverApp>;
		}
		const fromChildren = everAppsFromPluginOptions(plugin?.plugins);
		if (fromChildren.length) {
			return fromChildren;
		}
	}
	return [];
}

export function isCurrentEverApp(app: IEverApp): boolean {
	return app.id === CURRENT_EVER_APP_ID;
}
