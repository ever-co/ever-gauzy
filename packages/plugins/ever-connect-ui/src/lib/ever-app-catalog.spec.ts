import { EVER_APP_CATALOG } from './ever-app-catalog';

/**
 * The App Launcher's list is the same in every Ever app: same apps, same order, same lines, Demand marked "Soon",
 * each row going to the app (not the website).
 */
describe('EVER_APP_CATALOG', () => {
	it('lists the Ever apps in the order every Ever app shares, Ever Tech last', () => {
		expect(EVER_APP_CATALOG.map((app) => app.id)).toEqual([
			'platform',
			'works',
			'teams',
			'gauzy',
			'rec',
			'traduora',
			'demand',
			'tech'
		]);
	});

	it('marks Ever Demand, and only it, as coming soon', () => {
		const soon = EVER_APP_CATALOG.filter((app) => app.status === 'soon').map((app) => app.id);
		expect(soon).toEqual(['demand']);
		expect(EVER_APP_CATALOG.some((app) => app.status === 'beta')).toBe(false);
	});

	it('gives every app an https address and its domain', () => {
		for (const app of EVER_APP_CATALOG) {
			const url = new URL(app.url);
			expect(url.protocol).toBe('https:');
			expect(app.domain).toBe(url.host);
		}
	});

	it('links the apps, not the websites', () => {
		const hosts = Object.fromEntries(EVER_APP_CATALOG.map((app) => [app.id, new URL(app.url).host]));
		expect(hosts).toEqual({
			platform: 'app.ever.co',
			works: 'app.ever.works',
			teams: 'app.ever.team',
			gauzy: 'app.gauzy.co',
			rec: 'app.rec.so',
			traduora: 'app.traduora.co',
			demand: 'app.everdemand.co',
			tech: 'app.ever.tech'
		});
	});

	it('names every app in full, with "Ever", and gives each its own line key', () => {
		for (const app of EVER_APP_CATALOG) {
			expect(app.name).toBe(`Ever ${app.shortName}`);
			expect(app.lineKey).toBe(`APP_LAUNCHER.LINES.${app.id.toUpperCase()}`);
		}
		const keys = new Set(EVER_APP_CATALOG.map((app) => app.lineKey));
		expect(keys.size).toBe(EVER_APP_CATALOG.length);
	});

	it('uses a logo under the web assets for every app, with a relative path', () => {
		for (const app of EVER_APP_CATALOG) {
			expect(app.logo).toMatch(/^assets\/images\/ever-apps\/[a-z]+\.(svg|png)$/);
		}
	});
});
