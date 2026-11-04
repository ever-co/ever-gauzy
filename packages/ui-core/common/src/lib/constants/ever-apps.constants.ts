export type EverAppId = 'gauzy' | 'teams' | 'works' | 'platform' | 'demand' | 'rec' | 'traduora';

export interface IEverApp {
	id: EverAppId;
	shortName: string;
	logo: string;
	url: string;
	domain: string;
}

export const CURRENT_EVER_APP_ID: EverAppId = 'gauzy';

// Same apps, URLs and logos as the Ever Teams app switcher (ever-teams apps/web/core/constants/config/ever-apps.ts):
// keep both lists in sync. Works ships the Teams tile and Demand the Platform tile today, so those pairs look alike.
// Logo paths are relative so they resolve under the web base href and the desktop builds' `./` base href.
export const EVER_APPS: ReadonlyArray<IEverApp> = [
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

export function isCurrentEverApp(app: IEverApp): boolean {
	return app.id === CURRENT_EVER_APP_ID;
}
