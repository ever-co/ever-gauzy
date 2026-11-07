import { isTrelloConfigured, readTrelloConfig, trelloImportIntervalOf, trelloWebhooksEnabled, trelloWebhookTargetOf } from './trello-config';

describe('readTrelloConfig', () => {
	it('derives the return page and the webhook target from the platform URLs', () => {
		const config = readTrelloConfig({
			TRELLO_API_KEY: 'key',
			TRELLO_API_SECRET: 'secret',
			API_BASE_URL: 'https://api.example.com/',
			CLIENT_BASE_URL: 'https://app.example.com'
		});
		expect(config.returnUrl).toBe('https://app.example.com/#/pages/integrations/trello');
		expect(config.appName).toBe('Ever Gauzy');
		expect(config.apiUrl).toBe('https://api.trello.com/1');
		expect(trelloWebhooksEnabled(config)).toBe(true);
		expect(trelloWebhookTargetOf(config, 'm-1')).toBe('https://api.example.com/api/integration/trello/webhook/m-1');
		expect(isTrelloConfigured(config)).toBe(true);
	});

	it('reads the import interval as whole minutes, 0 switching the scheduled import off, and keeps the default otherwise', () => {
		const warn = jest.fn();
		expect(readTrelloConfig({}).importIntervalMinutes).toBe(15);
		expect(readTrelloConfig({ TRELLO_IMPORT_INTERVAL_MINUTES: ' 30 ' }).importIntervalMinutes).toBe(30);
		expect(readTrelloConfig({ TRELLO_IMPORT_INTERVAL_MINUTES: '0' }).importIntervalMinutes).toBe(0);
		expect(trelloImportIntervalOf('1.5', warn)).toBe(15);
		expect(trelloImportIntervalOf('-5', warn)).toBe(15);
		expect(warn).toHaveBeenCalledTimes(2);
	});

	it('prefers the explicit URLs, refuses unusable ones, and registers no webhook without a secret or a public address', () => {
		const warn = jest.fn();
		const config = readTrelloConfig(
			{ TRELLO_API_KEY: 'key', TRELLO_APP_NAME: ' Acme Tasks ', TRELLO_RETURN_URL: 'not a url', TRELLO_WEBHOOK_BASE_URL: 'https://hooks.example.com' },
			warn
		);
		expect(config.returnUrl).toBeNull();
		expect(config.appName).toBe('Acme Tasks');
		expect(config.webhookBaseUrl).toBe('https://hooks.example.com');
		expect(warn).toHaveBeenCalledTimes(1);
		expect(isTrelloConfigured(config)).toBe(false);
		// A public address without the secret cannot verify deliveries: no webhook.
		expect(trelloWebhooksEnabled(config)).toBe(false);
		expect(trelloWebhookTargetOf(config, 'm-1')).toBeNull();
		expect(trelloWebhookTargetOf(readTrelloConfig({ TRELLO_API_SECRET: 's' }), 'm-1')).toBeNull();
	});
});
