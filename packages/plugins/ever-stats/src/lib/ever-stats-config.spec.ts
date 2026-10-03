import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isEverStatsEnabled, readEverStatsConfig, servesTeams } from './ever-stats-config';
import { MODULE_VERSION } from './ever-stats.constants';

describe('EVER_STATS_ENABLED', () => {
	it.each([
		['unset', undefined, true, 0],
		['empty', '', true, 0],
		['true', 'true', true, 0],
		['false', 'false', false, 0],
		['TRUE', 'TRUE', true, 1],
		['1', '1', true, 1],
		['FALSE', 'FALSE', true, 1],
		['off', 'off', true, 1]
	])('%s → loaded %s, %i log line(s), never repeating the value', (_name, value, loaded, lines) => {
		const warn = jest.fn();
		expect(isEverStatsEnabled(value === undefined ? {} : { EVER_STATS_ENABLED: value }, warn)).toBe(loaded);
		expect(warn).toHaveBeenCalledTimes(lines);
		if (lines && value) {
			expect(String(warn.mock.calls[0][0])).not.toContain(`"${value}"`);
		}
	});
});

describe('readEverStatsConfig', () => {
	it('with no environment at all: on, https://api.ever.co, ZZ, gauzy, daily, self-hosted', () => {
		const warn = jest.fn();
		expect(readEverStatsConfig({}, warn)).toEqual({
			apiUrl: 'https://api.ever.co',
			country: 'ZZ',
			serves: ['gauzy'],
			intervalS: 86400,
			installSource: 'self-hosted'
		});
		expect(isEverStatsEnabled({})).toBe(true);
		expect(warn).not.toHaveBeenCalled();
	});

	it('takes EVER_STATS_API_URL, else EVER_PLATFORM_API_URL', () => {
		expect(readEverStatsConfig({ EVER_PLATFORM_API_URL: 'https://stats.example.test/' }).apiUrl).toBe('https://stats.example.test');
		expect(readEverStatsConfig({ EVER_PLATFORM_API_URL: 'https://a.example', EVER_STATS_API_URL: 'https://b.example' }).apiUrl).toBe('https://b.example');
	});

	it.each([
		['http://mock-platform:8080', 'http://mock-platform:8080'],
		['http://localhost:8080', 'http://localhost:8080'],
		['http://127.0.0.1:8080', 'http://127.0.0.1:8080'],
		['http://10.1.2.3', 'http://10.1.2.3'],
		['http://192.168.1.10:3000', 'http://192.168.1.10:3000'],
		['http://172.20.0.5', 'http://172.20.0.5']
	])('allows plain http to a local host: %s', (raw, url) => {
		const warn = jest.fn();
		expect(readEverStatsConfig({ EVER_STATS_API_URL: raw }, warn).apiUrl).toBe(url);
		expect(warn).not.toHaveBeenCalled();
	});

	it.each([
		['http://stats.corp.example'],
		['http://8.8.8.8'],
		['http://metadata'],
		['https://user:pw@stats.example.test'],
		['https://stats.example.test/?x=1'],
		['ftp://stats.example.test'],
		['not a url']
	])('refuses %s: nothing is sent (never another address), with one log line that does not repeat the value', (raw) => {
		const warn = jest.fn();
		expect(readEverStatsConfig({ EVER_STATS_API_URL: raw }, warn).apiUrl).toBeNull();
		expect(warn).toHaveBeenCalledTimes(1);
		expect(String(warn.mock.calls[0][0])).not.toContain(raw);
	});

	it('takes a declared country, never anything else', () => {
		expect(readEverStatsConfig({ EVER_STATS_COUNTRY: 'de' }).country).toBe('DE');
		const warn = jest.fn();
		expect(readEverStatsConfig({ EVER_STATS_COUNTRY: 'Germany' }, warn).country).toBe('ZZ');
		expect(warn).toHaveBeenCalledTimes(1);
	});

	it('reads EVER_STATS_SERVES', () => {
		expect(readEverStatsConfig({ EVER_STATS_SERVES: 'gauzy,teams' }).serves).toEqual(['gauzy', 'teams']);
		expect(readEverStatsConfig({ EVER_STATS_SERVES: 'teams, gauzy' }).serves).toEqual(['gauzy', 'teams']);
		expect(readEverStatsConfig({ EVER_STATS_SERVES: 'teams' }).serves).toEqual(['teams']);
		const warn = jest.fn();
		expect(readEverStatsConfig({ EVER_STATS_SERVES: 'gauzy,works' }, warn).serves).toEqual(['gauzy']);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(servesTeams({ EVER_STATS_SERVES: 'gauzy,teams' })).toBe(true);
		expect(servesTeams({})).toBe(false);
	});

	it('reads the interval override; below an hour only towards a local destination or in tests', () => {
		const local = { EVER_STATS_API_URL: 'http://mock-platform:8080' };
		expect(readEverStatsConfig({ ...local, EVER_STATS_SEND_INTERVAL_S: '5' }).intervalS).toBe(5);
		expect(readEverStatsConfig({ NODE_ENV: 'test', EVER_STATS_SEND_INTERVAL_S: '5' }).intervalS).toBe(5);
		expect(readEverStatsConfig({ EVER_STATS_SEND_INTERVAL_S: '3600' }).intervalS).toBe(3600);
		const warn = jest.fn();
		expect(readEverStatsConfig({ EVER_STATS_SEND_INTERVAL_S: '5' }, warn).intervalS).toBe(86400);
		expect(readEverStatsConfig({ EVER_STATS_API_URL: 'https://stats.example.test', EVER_STATS_SEND_INTERVAL_S: '60' }, warn).intervalS).toBe(86400);
		expect(warn).toHaveBeenCalledTimes(2);
		expect(readEverStatsConfig({ ...local, EVER_STATS_SEND_INTERVAL_S: '0' }).intervalS).toBe(86400);
		expect(readEverStatsConfig({ ...local, EVER_STATS_SEND_INTERVAL_S: '1.5' }).intervalS).toBe(86400);
	});

	it('sends module_version equal to the package version', () => {
		const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));
		expect(MODULE_VERSION).toBe(pkg.version);
	});
});
