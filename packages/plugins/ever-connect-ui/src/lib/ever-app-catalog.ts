import { IEverApp } from '@gauzy/ui-core/common';

/**
 * The Ever apps the App Launcher lists (`EVER_APPS` of `@gauzy/ui-core/common`), in their display order: the order
 * every Ever app shares (Ever Platform, Ever Works, Ever Teams, Ever Gauzy, Ever Rec, Ever Traduora, Ever Demand,
 * Ever Tech), with Demand marked "Soon" until a deployment links it.
 *
 * Same list, order and lines in every Ever app and site (homelab `docs/brand/EVER-SITES-UNIFIED-CHROME.md` §4 and
 * §4b). Keep the copies in sync: Ever Teams `apps/web/core/constants/config/ever-apps.ts` is the other in-app copy.
 * Each row shows the logo, the full name (`name`, never translated) and one line (`lineKey`, in every locale), and
 * no address. The logos are the Ever websites' tiles (`public/ever-apps/` of ever-website), byte for byte. Logo
 * paths are relative so they resolve under the web base href and the desktop builds' `./` base href.
 *
 * The addresses are the Ever-hosted apps' production hosts (`app.*`, not the websites; owner 2026-11-26). Ever Tech
 * has no app yet, so it links its site. Each Ever deployment points them at its own environment's apps with the web
 * app's `EVER_APP_LINKS` setting (`id=url` pairs, see `withEverAppLinks` of `@gauzy/ui-core/common`); unset, these
 * addresses are used.
 *
 * The catalog lives here, in an Ever Platform module, because it names Ever hosts: the egress audit keeps those out of
 * the core packages (`tools/egress-audit/static-hostnames.mjs`). `EverConnectUiPlugin` carries it in its options
 * (`EVER_APPS_PLUGIN_OPTION`), where the Gauzy web app finds it among the active UI plugins.
 */
export const EVER_APP_CATALOG: ReadonlyArray<IEverApp> = [
	{
		id: 'platform',
		shortName: 'Platform',
		name: 'Ever Platform',
		lineKey: 'APP_LAUNCHER.LINES.PLATFORM',
		logo: 'assets/images/ever-apps/platform.svg',
		url: 'https://app.ever.co',
		domain: 'app.ever.co'
	},
	{
		id: 'works',
		shortName: 'Works',
		name: 'Ever Works',
		lineKey: 'APP_LAUNCHER.LINES.WORKS',
		logo: 'assets/images/ever-apps/works.svg',
		url: 'https://app.ever.works',
		domain: 'app.ever.works'
	},
	{
		id: 'teams',
		shortName: 'Teams',
		name: 'Ever Teams',
		lineKey: 'APP_LAUNCHER.LINES.TEAMS',
		logo: 'assets/images/ever-apps/teams.svg',
		url: 'https://app.ever.team',
		domain: 'app.ever.team'
	},
	{
		id: 'gauzy',
		shortName: 'Gauzy',
		name: 'Ever Gauzy',
		lineKey: 'APP_LAUNCHER.LINES.GAUZY',
		logo: 'assets/images/ever-apps/gauzy.svg',
		url: 'https://app.gauzy.co',
		domain: 'app.gauzy.co'
	},
	{
		id: 'rec',
		shortName: 'Rec',
		name: 'Ever Rec',
		lineKey: 'APP_LAUNCHER.LINES.REC',
		logo: 'assets/images/ever-apps/rec.svg',
		url: 'https://app.rec.so',
		domain: 'app.rec.so'
	},
	{
		id: 'traduora',
		shortName: 'Traduora',
		name: 'Ever Traduora',
		lineKey: 'APP_LAUNCHER.LINES.TRADUORA',
		logo: 'assets/images/ever-apps/traduora.png',
		url: 'https://app.traduora.co',
		domain: 'app.traduora.co'
	},
	{
		id: 'demand',
		shortName: 'Demand',
		name: 'Ever Demand',
		lineKey: 'APP_LAUNCHER.LINES.DEMAND',
		logo: 'assets/images/ever-apps/demand.svg',
		url: 'https://app.everdemand.co',
		domain: 'app.everdemand.co',
		status: 'soon'
	},
	{
		id: 'tech',
		shortName: 'Tech',
		name: 'Ever Tech',
		lineKey: 'APP_LAUNCHER.LINES.TECH',
		logo: 'assets/images/ever-apps/tech.svg',
		url: 'https://ever.tech',
		domain: 'ever.tech'
	}
];
