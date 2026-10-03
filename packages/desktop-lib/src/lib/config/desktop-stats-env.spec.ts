import { desktopStatsEnv } from './desktop-stats-env';

describe('desktopStatsEnv', () => {
	it('always declares a desktop installation and its release', () => {
		expect(desktopStatsEnv({}, '111.48.2')).toEqual({ EVER_INSTALL_SOURCE: 'desktop', GAUZY_APP_VERSION: '111.48.2' });
		expect(desktopStatsEnv({ EVER_INSTALL_SOURCE: 'self-hosted' }, '1.2.3')['EVER_INSTALL_SOURCE']).toBe('desktop');
		expect(desktopStatsEnv(null, '')).toEqual({ EVER_INSTALL_SOURCE: 'desktop' });
	});

	it.each([
		['false', 'false'],
		['False', 'false'],
		[' OFF ', 'false'],
		['no', 'false'],
		['0', 'false'],
		['disabled', 'false'],
		['true', 'true'],
		['Yes', 'true'],
		['1', 'true'],
		['maybe', 'maybe']
	])('turns the switch "%s" typed in the settings into "%s"', (typed, sent) => {
		expect(desktopStatsEnv({ EVER_STATS_ENABLED: typed }, '1.0.0')['EVER_STATS_ENABLED']).toBe(sent);
	});

	it('leaves an empty switch to the default', () => {
		expect(desktopStatsEnv({ EVER_STATS_ENABLED: '  ' }, '1.0.0')).not.toHaveProperty('EVER_STATS_ENABLED');
		expect(desktopStatsEnv({}, '1.0.0')).not.toHaveProperty('EVER_STATS_ENABLED');
	});
});
