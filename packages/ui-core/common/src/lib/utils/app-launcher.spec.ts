import { hasOtherEverApp, IEverApp } from '../constants/ever-apps.constants';
import {
	APP_LAUNCHER_PLACEMENTS,
	DEFAULT_APP_LAUNCHER_PLACEMENT,
	isAppLauncherPlacement,
	parseAppLauncherPlacement,
	resolveEverApps,
	serializeAppLauncherPlacement,
	withDeploymentAddress
} from './app-launcher';

const CATALOG: ReadonlyArray<IEverApp> = [
	{
		id: 'platform',
		shortName: 'Platform',
		logo: 'p.svg',
		url: 'https://ever.catalog.test',
		domain: 'ever.catalog.test'
	},
	{ id: 'gauzy', shortName: 'Gauzy', logo: 'g.svg', url: 'https://gauzy.catalog.test', domain: 'gauzy.catalog.test' },
	{
		id: 'demand',
		shortName: 'Demand',
		logo: 'd.svg',
		url: 'https://demand.catalog.test',
		domain: 'demand.catalog.test',
		status: 'soon'
	}
];

describe('App Launcher position', () => {
	it('offers Sidebar, Top bar and Left rail, in that order, and defaults to the sidebar', () => {
		expect(APP_LAUNCHER_PLACEMENTS).toEqual(['sidebar', 'header', 'rail']);
		expect(DEFAULT_APP_LAUNCHER_PLACEMENT).toBe('sidebar');
	});

	it.each(['sidebar', 'header', 'rail'])('%p is a position', (value) => {
		expect(isAppLauncherPlacement(value)).toBe(true);
	});

	it.each([null, undefined, '', 'top', 'Sidebar', 42, {}])('%p is not a position', (value) => {
		expect(isAppLauncherPlacement(value)).toBe(false);
	});

	it.each([
		['"rail"', 'rail'],
		['"header"', 'header'],
		['rail', 'rail'],
		[' header ', 'header']
	])('reads %p (Ever Teams writes JSON, a bare value works too) as %p', (raw, expected) => {
		expect(parseAppLauncherPlacement(raw)).toBe(expected);
	});

	it.each([null, undefined, '', 'top', '"top"', '{', '["rail"]'])('reads %p as the default', (raw) => {
		expect(parseAppLauncherPlacement(raw)).toBe(DEFAULT_APP_LAUNCHER_PLACEMENT);
	});

	it('stores a position the way Ever Teams does, and reads it back', () => {
		for (const placement of APP_LAUNCHER_PLACEMENTS) {
			const stored = serializeAppLauncherPlacement(placement);
			expect(stored).toBe(`"${placement}"`);
			expect(parseAppLauncherPlacement(stored)).toBe(placement);
		}
	});
});

describe('App Launcher list', () => {
	it('shows the current app at this deployment address, the others as the catalog or EVER_APP_LINKS give them', () => {
		const apps = resolveEverApps(
			CATALOG,
			'platform=https://platform.stage.test,gauzy=https://ignored.test',
			'https://gauzy.self-hosted.test'
		);
		expect(apps.map((app) => [app.id, app.url, app.domain])).toEqual([
			['platform', 'https://platform.stage.test/', 'platform.stage.test'],
			['gauzy', 'https://gauzy.self-hosted.test', 'gauzy.self-hosted.test'],
			['demand', 'https://demand.catalog.test', 'demand.catalog.test']
		]);
		expect(apps[2].status).toBe('soon');
	});

	it.each([undefined, '', 'not a url', 'ftp://gauzy.test'])(
		'keeps the catalog row of the current app when CLIENT_BASE_URL is %p',
		(clientBaseUrl) => {
			expect(withDeploymentAddress(CATALOG[1], clientBaseUrl)).toBe(CATALOG[1]);
		}
	);

	it('shows the launcher only when an app other than this one is linked', () => {
		expect(hasOtherEverApp(CATALOG)).toBe(true);
		expect(hasOtherEverApp([CATALOG[1]])).toBe(false);
		expect(hasOtherEverApp([])).toBe(false);
		expect(hasOtherEverApp([CATALOG[1], { ...CATALOG[0], url: '' }])).toBe(false);
	});
});
