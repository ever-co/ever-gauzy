import type { IEverApp } from '../constants/ever-apps.constants';
import { parseEverAppLinks, withEverAppLinks } from './ever-app-links';

/**
 * `EVER_APP_LINKS`: this deployment's address of each Ever app in the switcher, `id=url` pairs separated by commas.
 * Unset, the switcher is exactly the catalog.
 */
describe('EVER_APP_LINKS', () => {
	const CATALOG: ReadonlyArray<IEverApp> = [
		{
			id: 'platform',
			shortName: 'Platform',
			logo: 'p.svg',
			url: 'https://platform.catalog.test',
			domain: 'platform.catalog.test'
		},
		{
			id: 'works',
			shortName: 'Works',
			logo: 'w.svg',
			url: 'https://works.catalog.test',
			domain: 'works.catalog.test'
		},
		{
			id: 'gauzy',
			shortName: 'Gauzy',
			logo: 'g.svg',
			url: 'https://gauzy.catalog.test',
			domain: 'gauzy.catalog.test'
		}
	];

	it.each([undefined, null, '', '   ', 'DOCKER_EVER_APP_LINKS'])('%p: the catalog, unchanged', (raw) => {
		expect(withEverAppLinks(CATALOG, raw)).toBe(CATALOG);
	});

	it('replaces the address and domain of the apps it names, and only those', () => {
		const apps = withEverAppLinks(CATALOG, 'platform=https://platform.stage.example.com');
		expect(apps).toEqual([
			{ ...CATALOG[0], url: 'https://platform.stage.example.com/', domain: 'platform.stage.example.com' },
			CATALOG[1],
			CATALOG[2]
		]);
		// The catalog itself is never changed.
		expect(CATALOG[0].url).toBe('https://platform.catalog.test');
	});

	it('reads several pairs, with spaces, paths and ports, in any order', () => {
		const apps = withEverAppLinks(
			CATALOG,
			' works = http://localhost:3030/app , platform=https://dev.example.com:8443/home?from=gauzy '
		);
		expect(apps.map((app) => [app.id, app.url, app.domain])).toEqual([
			['platform', 'https://dev.example.com:8443/home?from=gauzy', 'dev.example.com:8443'],
			['works', 'http://localhost:3030/app', 'localhost:3030'],
			['gauzy', CATALOG[2].url, CATALOG[2].domain]
		]);
	});

	it.each([
		['no "="', 'platform https://a.example.com'],
		['an empty id', '=https://a.example.com'],
		['an empty link', 'platform='],
		['a relative link', 'platform=/platform'],
		['a link that is not http(s)', 'platform=javascript:alert(1)'],
		['a data link', 'platform=data:text/html,hi'],
		['a link with credentials', 'platform=https://user:secret@a.example.com'],
		['an unknown id', 'unknown=https://a.example.com']
	])('ignores a pair with %s', (_, raw) => {
		expect(withEverAppLinks(CATALOG, raw)).toEqual(CATALOG);
	});

	it('never changes an app it is told to keep (the current app shows its own address)', () => {
		const raw = 'gauzy=https://other-gauzy.example.com,works=https://works.example.com';
		const apps = withEverAppLinks(CATALOG, raw, ['gauzy']);
		expect(apps[2]).toBe(CATALOG[2]);
		expect(apps[1].url).toBe('https://works.example.com/');
		expect(withEverAppLinks(CATALOG, 'gauzy=https://other-gauzy.example.com', ['gauzy'])).toBe(CATALOG);
	});

	it('the last pair of an id wins; a bad pair does not hide a good one', () => {
		expect(
			parseEverAppLinks('platform=https://one.example.com,platform=https://two.example.com').get('platform')?.host
		).toBe('two.example.com');
		const links = parseEverAppLinks('platform=ftp://x.example.com,works=https://works.example.com');
		expect([...links.keys()]).toEqual(['works']);
		// For one id: the last VALID pair wins, whichever side the ignored one is on.
		expect(
			parseEverAppLinks('platform=ftp://x.example.com,platform=https://ok.example.com').get('platform')?.host
		).toBe('ok.example.com');
		expect(
			parseEverAppLinks('platform=https://ok.example.com,platform=ftp://x.example.com').get('platform')?.host
		).toBe('ok.example.com');
	});
});
