import { parseSentryLogLevels } from './sentry-log-levels';

describe('parseSentryLogLevels', () => {
	it.each([undefined, '', '   ', 'nonsense', ',,'])('falls back to error only for %p', (value) => {
		expect(parseSentryLogLevels(value)).toEqual(['error']);
	});

	it('reads a comma-separated list, case- and space-insensitively', () => {
		expect(parseSentryLogLevels(' Error , WARN ')).toEqual(['error', 'warn']);
	});

	it('ignores unknown names and duplicates but keeps the valid ones', () => {
		expect(parseSentryLogLevels('error,info,error,log')).toEqual(['error', 'log']);
	});
});
