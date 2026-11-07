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
 * apps) belongs to the Ever Platform UI module, `EVER_APP_CATALOG` of `@gauzy/plugin-ever-connect-ui`, which the
 * Gauzy web app provides through `provideEverApps`. A deployment without that module shows no switcher.
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

export function isCurrentEverApp(app: IEverApp): boolean {
	return app.id === CURRENT_EVER_APP_ID;
}
