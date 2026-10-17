import { DEFAULT_LOG_LEVELS, isLogLevelEnabled, resolveLogLevels } from './log-levels';

describe('resolveLogLevels', () => {
	it('keeps every level when LOG_LEVEL is unset, as the API always did', () => {
		expect(resolveLogLevels(undefined)).toEqual(DEFAULT_LOG_LEVELS);
		expect(resolveLogLevels('')).toEqual(DEFAULT_LOG_LEVELS);
	});

	it('reads the deployments\' LOG_LEVEL=info as log, warn, error and fatal — no debug or verbose', () => {
		expect(resolveLogLevels('info')).toEqual(['fatal', 'error', 'warn', 'log']);
		expect(isLogLevelEnabled('debug', 'info')).toBe(false);
		expect(isLogLevelEnabled('log', 'info')).toBe(true);
	});

	it('enables a level and everything more severe', () => {
		expect(resolveLogLevels('error')).toEqual(['fatal', 'error']);
		expect(resolveLogLevels('WARN')).toEqual(['fatal', 'error', 'warn']);
		expect(resolveLogLevels('debug')).toEqual(['fatal', 'error', 'warn', 'log', 'debug']);
		expect(resolveLogLevels('verbose')).toEqual(['fatal', 'error', 'warn', 'log', 'debug', 'verbose']);
	});

	it('falls back to every level, with a warning, for an unknown value', () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		expect(resolveLogLevels('loud')).toEqual(DEFAULT_LOG_LEVELS);
		expect(warn).toHaveBeenCalledTimes(1);
		warn.mockRestore();
	});
});
