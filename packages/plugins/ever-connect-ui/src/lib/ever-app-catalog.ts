import { IEverApp } from '@gauzy/ui-core/common';

/**
 * The Ever apps the App Launcher lists (`EVER_APPS` of `@gauzy/ui-core/common`), in their display order: the order
 * every Ever app shares (Ever Platform, Ever Works, Ever Teams, Ever Gauzy, Ever Rec, Ever Traduora, Ever Demand),
 * with Demand marked "Soon". Same apps, URLs and logos as the Ever Teams app switcher (ever-teams
 * `apps/web/core/constants/config/ever-apps.ts`): keep both lists in sync. Works ships the Teams tile and Demand the
 * Platform tile today, so those pairs look alike. Logo paths are relative so they resolve under the web base href and
 * the desktop builds' `./` base href.
 *
 * The catalog lives here, in an Ever Platform module, because it names Ever hosts: the egress audit keeps those out of
 * the core packages (`tools/egress-audit/static-hostnames.mjs`). `EverConnectUiPlugin` carries it in its options
 * (`EVER_APPS_PLUGIN_OPTION`), where the Gauzy web app finds it among the active UI plugins.
 *
 * These are the addresses of the Ever-hosted apps. A deployment points any of them elsewhere (a staging Ever Platform,
 * its own Works) with the web app's `EVER_APP_LINKS` setting (`id=url` pairs, see `withEverAppLinks` of
 * `@gauzy/ui-core/common`); unset, these addresses are used.
 */
export const EVER_APP_CATALOG: ReadonlyArray<IEverApp> = [
	{
		id: 'platform',
		shortName: 'Platform',
		logo: 'assets/images/ever-apps/platform.svg',
		url: 'https://ever.co',
		domain: 'ever.co'
	},
	{
		id: 'works',
		shortName: 'Works',
		logo: 'assets/images/ever-apps/works.svg',
		url: 'https://app.ever.works',
		domain: 'app.ever.works'
	},
	{
		id: 'teams',
		shortName: 'Teams',
		logo: 'assets/images/ever-apps/teams.svg',
		url: 'https://app.ever.team',
		domain: 'app.ever.team'
	},
	{
		id: 'gauzy',
		shortName: 'Gauzy',
		logo: 'assets/images/ever-apps/gauzy.svg',
		url: 'https://app.gauzy.co',
		domain: 'app.gauzy.co'
	},
	{ id: 'rec', shortName: 'Rec', logo: 'assets/images/ever-apps/rec.svg', url: 'https://rec.so', domain: 'rec.so' },
	{
		id: 'traduora',
		shortName: 'Traduora',
		logo: 'assets/images/ever-apps/traduora.png',
		url: 'https://traduora.co',
		domain: 'traduora.co'
	},
	{
		id: 'demand',
		shortName: 'Demand',
		logo: 'assets/images/ever-apps/demand.svg',
		url: 'https://everdemand.co',
		domain: 'everdemand.co',
		status: 'soon'
	}
];
