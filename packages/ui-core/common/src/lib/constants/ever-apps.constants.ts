export type EverAppId = 'gauzy' | 'teams' | 'works' | 'platform' | 'demand' | 'rec' | 'traduora';

export interface IEverApp {
	id: EverAppId;
	shortName: string;
	monogram: string;
	url: string;
	domain: string;
}

export const CURRENT_EVER_APP_ID: EverAppId = 'gauzy';

// Same apps and URLs as the Ever Teams app switcher (ever-teams apps/web/core/constants/config/ever-apps.ts):
// keep both lists in sync. Traduora keeps two letters so its tile does not read as a second Teams.
export const EVER_APPS: ReadonlyArray<IEverApp> = [
	{ id: 'platform', shortName: 'Platform', monogram: 'P', url: 'https://ever.co', domain: 'ever.co' },
	{ id: 'works', shortName: 'Works', monogram: 'W', url: 'https://app.ever.works', domain: 'app.ever.works' },
	{ id: 'teams', shortName: 'Teams', monogram: 'T', url: 'https://app.ever.team', domain: 'app.ever.team' },
	{ id: 'gauzy', shortName: 'Gauzy', monogram: 'G', url: 'https://app.gauzy.co', domain: 'app.gauzy.co' },
	{ id: 'demand', shortName: 'Demand', monogram: 'D', url: 'https://everdemand.co', domain: 'everdemand.co' },
	{ id: 'rec', shortName: 'Rec', monogram: 'R', url: 'https://rec.so', domain: 'rec.so' },
	{ id: 'traduora', shortName: 'Traduora', monogram: 'Tr', url: 'https://traduora.co', domain: 'traduora.co' }
];

export function isCurrentEverApp(app: IEverApp): boolean {
	return app.id === CURRENT_EVER_APP_ID;
}
