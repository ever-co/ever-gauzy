import { EVER_APP_CATALOG } from './ever-app-catalog';

/** The App Launcher's list is the same in every Ever app: same apps, same order, Demand marked "Soon". */
describe('EVER_APP_CATALOG', () => {
	it('lists the Ever apps in the order every Ever app shares', () => {
		expect(EVER_APP_CATALOG.map((app) => app.id)).toEqual([
			'platform',
			'works',
			'teams',
			'gauzy',
			'rec',
			'traduora',
			'demand'
		]);
	});

	it('marks Ever Demand, and only it, as coming soon', () => {
		const soon = EVER_APP_CATALOG.filter((app) => app.status === 'soon').map((app) => app.id);
		expect(soon).toEqual(['demand']);
		expect(EVER_APP_CATALOG.some((app) => app.status === 'beta')).toBe(false);
	});

	it('gives every app a web address and the domain shown under its name', () => {
		for (const app of EVER_APP_CATALOG) {
			const url = new URL(app.url);
			expect(url.protocol).toBe('https:');
			expect(app.domain).toBe(url.host);
		}
	});
});
