import { InjectionToken, Provider } from '@angular/core';

export type EverAppId = 'gauzy' | 'teams' | 'works' | 'platform' | 'demand' | 'rec' | 'traduora' | 'tech';

/**
 * Where an Ever app stands, shown as a chip beside its name in the App Launcher: `beta` ("Beta") or `soon`
 * ("Soon"). Unset for an app that is generally available. The row still opens the app's address either way.
 *
 * `soon` lasts only while the deployment does not link the app: an `EVER_APP_LINKS` pair for it (see
 * `withEverAppLinks`) says the app is reachable from this deployment, and the chip goes.
 */
export type EverAppStatus = 'beta' | 'soon';

export interface IEverApp {
	id: EverAppId;
	/** The short name ("Works"). */
	shortName: string;
	/** The full name ("Ever Works"), shown in the App Launcher and never translated. */
	name: string;
	/** The i18n key of the one line under the name ("AI agents that run your business"). */
	lineKey: string;
	logo: string;
	/** Where the row goes, in the same tab (the system browser inside the desktop apps). */
	url: string;
	/** The host of `url`. The App Launcher does not show it (no addresses in the list, owner 2026-11-26). */
	domain: string;
	status?: EverAppStatus;
}

export const CURRENT_EVER_APP_ID: EverAppId = 'gauzy';

/** The Ever app whose `/apps` page adds a person's own apps: the "+ Add" row links there. */
export const EVER_PLATFORM_APP_ID: EverAppId = 'platform';

/**
 * The page of Ever Platform where a person adds their own apps, with the "Add an app" dialog open, relative to
 * Ever Platform's address. It carries no organization: Ever Platform picks the person's organization.
 */
export const EVER_PLATFORM_ADD_APP_PATH = '/apps?add=app';

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

/**
 * Whether the list links at least one Ever app besides this one. The App Launcher (its button, its rail and its
 * setting) shows only then, as Ever Teams does: a deployment that links no other app has nothing to launch.
 *
 * @param apps - The App Launcher's list, as this deployment serves it.
 */
export function hasOtherEverApp(apps: ReadonlyArray<IEverApp>): boolean {
	return apps.some((app) => !isCurrentEverApp(app) && Boolean(app.url));
}
