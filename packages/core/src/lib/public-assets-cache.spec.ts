import { DEFAULT_PUBLIC_ASSETS_MAX_AGE_SECONDS, resolvePublicAssetsMaxAgeSeconds } from './public-assets-cache';

describe('resolvePublicAssetsMaxAgeSeconds', () => {
	const silent = { warn: jest.fn() };

	beforeEach(() => silent.warn.mockClear());

	it('defaults to one day', () => {
		expect(resolvePublicAssetsMaxAgeSeconds({}, silent)).toBe(DEFAULT_PUBLIC_ASSETS_MAX_AGE_SECONDS);
		expect(DEFAULT_PUBLIC_ASSETS_MAX_AGE_SECONDS).toBe(86400);
		expect(silent.warn).not.toHaveBeenCalled();
	});

	it('reads a whole number of seconds, 0 included', () => {
		expect(resolvePublicAssetsMaxAgeSeconds({ PUBLIC_ASSETS_MAX_AGE_SECONDS: '3600' }, silent)).toBe(3600);
		expect(resolvePublicAssetsMaxAgeSeconds({ PUBLIC_ASSETS_MAX_AGE_SECONDS: '0' }, silent)).toBe(0);
	});

	it.each(['1d', '-5', '1.5', 'forever'])('falls back to the default for %j, with a warning', (value) => {
		expect(resolvePublicAssetsMaxAgeSeconds({ PUBLIC_ASSETS_MAX_AGE_SECONDS: value }, silent)).toBe(
			DEFAULT_PUBLIC_ASSETS_MAX_AGE_SECONDS
		);
		expect(silent.warn).toHaveBeenCalledTimes(1);
	});
});
