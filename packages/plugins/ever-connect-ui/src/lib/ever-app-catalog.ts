import { IEverApp } from '@gauzy/ui-core/common';

/**
 * The Ever apps the app switcher lists (`EVER_APPS` of `@gauzy/ui-core/common`), in their display order. Same apps,
 * URLs and logos as the Ever Teams app switcher (ever-teams `apps/web/core/constants/config/ever-apps.ts`): keep both
 * lists in sync. Works ships the Teams tile and Demand the Platform tile today, so those pairs look alike. Logo paths
 * are relative so they resolve under the web base href and the desktop builds' `./` base href.
 *
 * The catalog lives here, in an Ever Platform module, because it names Ever hosts: the egress audit keeps those out of
 * the core packages (`tools/egress-audit/static-hostnames.mjs`). `EverConnectUiPlugin` carries it in its options
 * (`EVER_APPS_PLUGIN_OPTION`), where the Gauzy web app finds it among the active UI plugins.
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
	{
		id: 'demand',
		shortName: 'Demand',
		logo: 'assets/images/ever-apps/demand.svg',
		url: 'https://everdemand.co',
		domain: 'everdemand.co'
	},
	{ id: 'rec', shortName: 'Rec', logo: 'assets/images/ever-apps/rec.svg', url: 'https://rec.so', domain: 'rec.so' },
	{
		id: 'traduora',
		shortName: 'Traduora',
		logo: 'assets/images/ever-apps/traduora.png',
		url: 'https://traduora.co',
		domain: 'traduora.co'
	}
];
