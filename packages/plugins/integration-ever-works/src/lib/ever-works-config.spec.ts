import { normaliseEverWorksBaseUrl, readEverWorksConfig } from './ever-works-config';

describe('readEverWorksConfig', () => {
	it('is empty by default (no URL is offered, nothing is called)', () => {
		const warn = jest.fn();
		expect(readEverWorksConfig({}, warn)).toEqual({ defaultApiUrl: null, appUrl: null });
		expect(warn).not.toHaveBeenCalled();
	});

	it('offers configured public HTTPS URLs without the trailing slash', () => {
		expect(
			readEverWorksConfig({
				EVER_WORKS_API_URL: 'https://api.example.test/api/',
				EVER_WORKS_APP_URL: 'https://app.example.test'
			})
		).toEqual({ defaultApiUrl: 'https://api.example.test/api', appUrl: 'https://app.example.test' });
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

	it('treats a blank value as unset', () => {
		const warn = jest.fn();
		expect(normaliseEverWorksBaseUrl('   ', 'EVER_WORKS_APP_URL', warn)).toBeNull();
		expect(warn).not.toHaveBeenCalled();
	});
});
