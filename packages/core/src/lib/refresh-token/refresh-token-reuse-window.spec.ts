import {
	DEFAULT_REFRESH_TOKEN_REUSE_WINDOW_S,
	MAX_REFRESH_TOKEN_REUSE_WINDOW_S,
	refreshTokenReuseWindowMs
} from './refresh-token-reuse-window';

describe('the reuse window of a rotated refresh token, as JWT_REFRESH_TOKEN_REUSE_WINDOW sets it', () => {
	it.each([undefined, null, '', '  '])('is the default when the variable is not set (%p)', (configured) => {
		expect(refreshTokenReuseWindowMs(configured)).toBe(DEFAULT_REFRESH_TOKEN_REUSE_WINDOW_S * 1000);
	});

	it('is the number of seconds the variable gives', () => {
		expect(refreshTokenReuseWindowMs('30')).toBe(30_000);
		expect(refreshTokenReuseWindowMs(5)).toBe(5_000);
	});

	it('is turned off by 0: a refresh token is then accepted once only', () => {
		expect(refreshTokenReuseWindowMs('0')).toBe(0);
	});

	it('is never longer than the ceiling', () => {
		expect(refreshTokenReuseWindowMs('86400')).toBe(MAX_REFRESH_TOKEN_REUSE_WINDOW_S * 1000);
	});

	it.each(['soon', '-5', 'NaN', 'Infinity'])('is the default for a value that is not a time (%s)', (configured) => {
		expect(refreshTokenReuseWindowMs(configured)).toBe(DEFAULT_REFRESH_TOKEN_REUSE_WINDOW_S * 1000);
	});
});
