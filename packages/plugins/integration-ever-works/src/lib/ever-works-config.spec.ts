import { normaliseEverWorksBaseUrl, readEverWorksConfig } from './ever-works-config';

describe('readEverWorksConfig', () => {
	it('is empty by default (no URL is offered, nothing is called)', () => {
		const warn = jest.fn();
		expect(readEverWorksConfig({}, warn)).toEqual({ defaultApiUrl: null, appUrl: null, gauzyApiUrl: null, gauzyAppUrl: null, allowLoopback: false });
		expect(warn).not.toHaveBeenCalled();
	});

	it('offers configured public HTTPS URLs without the trailing slash', () => {
		expect(
			readEverWorksConfig({
				EVER_WORKS_API_URL: 'https://api.example.test/api/',
				EVER_WORKS_APP_URL: 'https://app.example.test'
			})
		).toEqual({ defaultApiUrl: 'https://api.example.test/api', appUrl: 'https://app.example.test', gauzyApiUrl: null, gauzyAppUrl: null, allowLoopback: false });
	});

	it('takes the public API address for webhooks from API_BASE_URL, silently ignoring a local one', () => {
		const warn = jest.fn();
		expect(readEverWorksConfig({ API_BASE_URL: 'https://api.gauzy.example/' }, warn).gauzyApiUrl).toBe('https://api.gauzy.example');
		expect(readEverWorksConfig({ API_BASE_URL: 'http://localhost:3000' }, warn).gauzyApiUrl).toBeNull();
		// The web app the Ever Works copies of Gauzy Inbox items link back to: CLIENT_BASE_URL, else APP_LINK; HTTPS only.
		expect(readEverWorksConfig({ CLIENT_BASE_URL: 'https://app.gauzy.example/' }, warn).gauzyAppUrl).toBe('https://app.gauzy.example');
		expect(readEverWorksConfig({ APP_LINK: 'https://link.gauzy.example' }, warn).gauzyAppUrl).toBe('https://link.gauzy.example');
		expect(readEverWorksConfig({ CLIENT_BASE_URL: 'http://localhost:4200', APP_LINK: '' }, warn).gauzyAppUrl).toBeNull();
		expect(warn).not.toHaveBeenCalled();
	});

	it.each([
		['plain http', 'http://api.example.test/api'],
		['loopback', 'https://127.0.0.1/api'],
		['private network', 'https://10.0.0.5/api'],
		['localhost', 'https://localhost/api'],
		['credentials', 'https://user:pass@api.example.test/api'],
		['a query', 'https://api.example.test/api?x=1'],
		['a fragment', 'https://api.example.test/api#x'],
		['not a URL', 'api.example.test']
	])('ignores %s and warns without the value', (_name, value) => {
		const warn = jest.fn();
		expect(normaliseEverWorksBaseUrl(value, 'EVER_WORKS_API_URL', warn)).toBeNull();
		expect(warn).toHaveBeenCalledTimes(1);
		expect(String(warn.mock.calls[0][0])).toContain('EVER_WORKS_API_URL');
		expect(String(warn.mock.calls[0][0])).not.toContain(value);
	});

	describe('EVER_WORKS_ALLOW_LOOPBACK (local development only)', () => {
		const local = { EVER_WORKS_API_URL: 'http://127.0.0.1:3100/api', API_BASE_URL: 'http://127.0.0.1:3000' };

		it('admits loopback addresses over HTTP in a development process', () => {
			const config = readEverWorksConfig({ ...local, NODE_ENV: 'development', EVER_WORKS_ALLOW_LOOPBACK: 'true' });
			expect(config).toMatchObject({ allowLoopback: true, defaultApiUrl: 'http://127.0.0.1:3100/api', gauzyApiUrl: 'http://127.0.0.1:3000' });
			const test = readEverWorksConfig({ API_BASE_URL: 'http://localhost:3000/', NODE_ENV: 'test', EVER_WORKS_ALLOW_LOOPBACK: 'true' });
			expect(test.gauzyApiUrl).toBe('http://localhost:3000');
		});

		it.each([
			['production', { NODE_ENV: 'production', EVER_WORKS_ALLOW_LOOPBACK: 'true' }],
			['NODE_ENV unset', { EVER_WORKS_ALLOW_LOOPBACK: 'true' }],
			['a value other than true', { NODE_ENV: 'development', EVER_WORKS_ALLOW_LOOPBACK: '1' }]
		])('is ignored (with a warning) in %s', (_name, env) => {
			const warn = jest.fn();
			const config = readEverWorksConfig({ ...local, ...env }, warn);
			expect(config).toMatchObject({ allowLoopback: false, gauzyApiUrl: null, defaultApiUrl: null });
			expect(warn.mock.calls.some(([message]) => String(message).includes('EVER_WORKS_ALLOW_LOOPBACK'))).toBe(true);
		});

		it.each([
			['a private address', 'http://10.0.0.5:3000'],
			['link-local metadata', 'http://169.254.169.254'],
			['another 127/8 address', 'http://127.0.0.2:3000'],
			['a public host over plain HTTP', 'http://api.gauzy.example'],
			['loopback with credentials', 'http://user:pass@127.0.0.1:3000']
		])('still refuses %s with the switch on', (_name, value) => {
			const config = readEverWorksConfig({ API_BASE_URL: value, NODE_ENV: 'development', EVER_WORKS_ALLOW_LOOPBACK: 'true' });
			expect(config.gauzyApiUrl).toBeNull();
		});
	});

	it('treats a blank value as unset', () => {
		const warn = jest.fn();
		expect(normaliseEverWorksBaseUrl('   ', 'EVER_WORKS_APP_URL', warn)).toBeNull();
		expect(warn).not.toHaveBeenCalled();
	});
});
