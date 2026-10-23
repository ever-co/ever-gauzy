import { readNonNegativeIntEnv } from './strict-int-env';

describe('readNonNegativeIntEnv', () => {
	const logger = { warn: jest.fn() };
	beforeEach(() => logger.warn.mockReset());

	it('reads plain whole numbers, 0 included', () => {
		expect(readNonNegativeIntEnv('X', '250', 9, logger)).toBe(250);
		expect(readNonNegativeIntEnv('X', ' 0 ', 9, logger)).toBe(0);
		expect(logger.warn).not.toHaveBeenCalled();
	});

	it('falls back silently when unset or blank', () => {
		expect(readNonNegativeIntEnv('X', undefined, 9, logger)).toBe(9);
		expect(readNonNegativeIntEnv('X', '  ', 9, logger)).toBe(9);
		expect(logger.warn).not.toHaveBeenCalled();
	});

	it.each(['2s', '1e3', '1.5', '-1', '10abc', 'abc'])('refuses "%s" with a warning instead of reading a prefix', (raw) => {
		expect(readNonNegativeIntEnv('X', raw, 9, logger)).toBe(9);
		expect(logger.warn).toHaveBeenCalledTimes(1);
	});
});
