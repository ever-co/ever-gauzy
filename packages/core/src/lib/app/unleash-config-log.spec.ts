import { InMemStorageProvider, UnleashConfig } from 'unleash-client';
import { describeUnleashConfig } from './unleash-config-log';

/**
 * `app.module.ts` used to log `JSON.stringify(unleashConfig)` at boot, which included
 * `customHeaders.Authorization` - the Unleash API key. The line it logs now comes from
 * `describeUnleashConfig`.
 */
describe('describeUnleashConfig', () => {
	const API_KEY = 'dummy-unleash-api-key';

	const config = (overrides: Partial<UnleashConfig> = {}): UnleashConfig => ({
		appName: 'gauzy-api',
		url: 'https://unleash.example.com/api',
		instanceId: 'api-1',
		refreshInterval: 15000,
		metricsInterval: 60000,
		disableMetrics: false,
		storageProvider: new InMemStorageProvider(),
		...overrides
	});

	it('lists the custom headers by name but never logs the API key', () => {
		const line = describeUnleashConfig(config({ customHeaders: { Authorization: API_KEY } }));

		expect(line).not.toContain(API_KEY);
		// Control: the rest of the config is still there for diagnostics.
		expect(line.startsWith('Using Unleash Config: ')).toBe(true);
		const logged = JSON.parse(line.slice('Using Unleash Config: '.length));
		expect(logged).toMatchObject({
			appName: 'gauzy-api',
			url: 'https://unleash.example.com/api',
			instanceId: 'api-1',
			customHeaders: { Authorization: '***' }
		});
	});

	it('redacts credentials embedded in the Unleash URL', () => {
		const line = describeUnleashConfig(config({ url: `https://admin:${API_KEY}@unleash.example.com/api` }));

		expect(line).not.toContain(API_KEY);
		expect(line).toContain('https://admin:***@unleash.example.com/api');
	});

	it('omits customHeaders when none are configured', () => {
		const logged = JSON.parse(describeUnleashConfig(config()).slice('Using Unleash Config: '.length));

		expect(logged).not.toHaveProperty('customHeaders');
		expect(logged.appName).toBe('gauzy-api');
	});

	it('does not modify the config that is handed to initialize()', () => {
		const original = config({ customHeaders: { Authorization: API_KEY } });

		describeUnleashConfig(original);

		expect(original.customHeaders).toEqual({ Authorization: API_KEY });
	});
});
