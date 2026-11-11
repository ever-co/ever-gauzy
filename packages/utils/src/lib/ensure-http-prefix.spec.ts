import { ensureHttpPrefix } from './ensure-http-prefix';

describe('ensureHttpPrefix', () => {
	it('adds https:// to a bare host by default', () => {
		expect(ensureHttpPrefix('example.com')).toBe('https://example.com');
	});

	it('adds the requested protocol to a bare host', () => {
		expect(ensureHttpPrefix('example.com', 'http')).toBe('http://example.com');
	});

	it('leaves a URL that already has a lower-case scheme untouched', () => {
		expect(ensureHttpPrefix('https://example.com')).toBe('https://example.com');
		expect(ensureHttpPrefix('http://example.com')).toBe('http://example.com');
	});

	it('leaves a URL with an upper- or mixed-case scheme untouched instead of prefixing it again', () => {
		expect(ensureHttpPrefix('HTTPS://example.com')).toBe('HTTPS://example.com');
		expect(ensureHttpPrefix('Http://example.com')).toBe('Http://example.com');
	});

	it('returns an empty or missing value as it is', () => {
		expect(ensureHttpPrefix('')).toBe('');
		expect(ensureHttpPrefix(undefined as unknown as string)).toBeUndefined();
	});
});
