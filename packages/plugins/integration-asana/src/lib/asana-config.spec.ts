import { asanaWebhookTargetOf, isAsanaConfigured, readAsanaConfig, asanaImportIntervalOf } from './asana-config';

describe('readAsanaConfig', () => {
	it('derives the callback, the post-install page and the webhook target from the platform URLs', () => {
		const config = readAsanaConfig({
			ASANA_CLIENT_ID: 'id',
			ASANA_CLIENT_SECRET: 'secret',
			API_BASE_URL: 'https://api.example.com/',
			CLIENT_BASE_URL: 'https://app.example.com'
		});
		expect(config.redirectUrl).toBe('https://api.example.com/api/integration/asana/callback');
		expect(config.postInstallUrl).toBe('https://app.example.com/#/pages/integrations/asana');
		expect(config.apiUrl).toBe('https://app.asana.com/api/1.0');
		expect(asanaWebhookTargetOf(config, 'm-1')).toBe('https://api.example.com/api/integration/asana/webhook/m-1');
		expect(asanaWebhookTargetOf(config, 'm-1', 'tok/en')).toBe('https://api.example.com/api/integration/asana/webhook/m-1?handshake=tok%2Fen');
		expect(isAsanaConfigured(config)).toBe(true);
	});

	it('reads the import interval as whole minutes, 0 switching the scheduled import off, and keeps the default otherwise', () => {
		const warn = jest.fn();
		expect(readAsanaConfig({}).importIntervalMinutes).toBe(15);
		expect(readAsanaConfig({ ASANA_IMPORT_INTERVAL_MINUTES: ' 30 ' }).importIntervalMinutes).toBe(30);
		expect(readAsanaConfig({ ASANA_IMPORT_INTERVAL_MINUTES: '0' }).importIntervalMinutes).toBe(0);
		expect(asanaImportIntervalOf('1.5', warn)).toBe(15);
		expect(asanaImportIntervalOf('-5', warn)).toBe(15);
		expect(warn).toHaveBeenCalledTimes(2);
	});

	it('prefers the explicit URLs, refuses unusable ones, and registers no webhook without a public address', () => {
		const warn = jest.fn();
		const config = readAsanaConfig(
			{ ASANA_REDIRECT_URL: 'https://other.example.com/cb', ASANA_POST_INSTALL_URL: 'not a url', ASANA_WEBHOOK_BASE_URL: 'https://hooks.example.com' },
			warn
		);
		expect(config.redirectUrl).toBe('https://other.example.com/cb');
		expect(config.postInstallUrl).toBeNull();
		expect(config.webhookBaseUrl).toBe('https://hooks.example.com');
		expect(warn).toHaveBeenCalledTimes(1);
		expect(isAsanaConfigured(config)).toBe(false);
		expect(asanaWebhookTargetOf(readAsanaConfig({}), 'm-1')).toBeNull();
	});
});
