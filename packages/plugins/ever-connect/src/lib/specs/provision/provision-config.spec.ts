import { isProvisionEnabled, readEverConnectConfig } from '../../ever-connect-config';

/** `EVER_CONNECT_PROVISION_ENABLED` is read strictly: only the exact `true` turns it on. */
describe('EVER_CONNECT_PROVISION_ENABLED', () => {
	it.each([
		['unset', undefined, false, 0],
		['empty', '', false, 0],
		['false', 'false', false, 0],
		['true', 'true', true, 0],
		['TRUE', 'TRUE', false, 1],
		['1', '1', false, 1],
		['yes', 'yes', false, 1],
		['a padded true', ' true', false, 1]
	])('%s: on %s, %i warning(s)', (_name, value, on, warnings) => {
		const warn = jest.fn();
		expect(isProvisionEnabled({ EVER_CONNECT_PROVISION_ENABLED: value }, warn)).toBe(on);
		expect(warn).toHaveBeenCalledTimes(warnings);
		for (const [message] of warn.mock.calls) {
			// The warning names the switch and its two values, never what was typed.
			expect(message.replace(/"true"|"false"/g, '')).not.toMatch(/TRUE|\b1\b|yes| true/);
		}
	});

	it('is off by default, and carries the web app and API addresses sent back to Ever Platform', () => {
		expect(readEverConnectConfig({}).provision).toEqual({
			enabled: false,
			appUrl: 'http://localhost:4200',
			apiUrl: 'http://localhost:3000'
		});
		expect(
			readEverConnectConfig({
				EVER_CONNECT_PROVISION_ENABLED: 'true',
				CLIENT_BASE_URL: 'https://app.gauzy.example/',
				API_BASE_URL: 'https://api.gauzy.example/'
			}).provision
		).toEqual({ enabled: true, appUrl: 'https://app.gauzy.example', apiUrl: 'https://api.gauzy.example' });
	});

	it.each([
		['a query', 'https://app.gauzy.example/?x=1'],
		['a fragment', 'https://app.gauzy.example/#/x'],
		['credentials', 'https://user:pw@app.gauzy.example'],
		['another scheme', 'ftp://app.gauzy.example'],
		['plain http off this computer', 'http://app.gauzy.example'],
		['no URL', 'app.gauzy.example']
	])('stays off, with a warning, when CLIENT_BASE_URL has %s', (_name, value) => {
		const warn = jest.fn();
		const config = readEverConnectConfig({ EVER_CONNECT_PROVISION_ENABLED: 'true', CLIENT_BASE_URL: value }, warn);
		expect(config.provision.enabled).toBe(false);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('CLIENT_BASE_URL and API_BASE_URL'));
	});
});
