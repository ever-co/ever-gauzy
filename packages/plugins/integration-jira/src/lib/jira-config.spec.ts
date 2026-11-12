import { isJiraConfigured, jiraImportIntervalOf, jiraWebhooksEnabled, jiraWebhookTargetOf, readJiraConfig } from './jira-config';

describe('readJiraConfig', () => {
	it('derives the callback, the post-install page and the webhook address from the platform URLs', () => {
		const config = readJiraConfig({
			JIRA_CLIENT_ID: 'id',
			JIRA_CLIENT_SECRET: 'secret',
			API_BASE_URL: 'https://api.example.com/',
			CLIENT_BASE_URL: 'https://app.example.com'
		});
		expect(config.redirectUrl).toBe('https://api.example.com/api/integration/jira/callback');
		expect(config.postInstallUrl).toBe('https://app.example.com/#/pages/integrations/jira');
		expect(config.webhookBaseUrl).toBe('https://api.example.com/api/integration/jira/webhook');
		expect(config.apiUrl).toBe('https://api.atlassian.com');
		expect(config.authorizeUrl).toBe('https://auth.atlassian.com/authorize');
		expect(config.tokenUrl).toBe('https://auth.atlassian.com/oauth/token');
		expect(isJiraConfigured(config)).toBe(true);
		expect(jiraWebhooksEnabled(config)).toBe(true);
		expect(jiraWebhookTargetOf(config, 'abc123')).toBe('https://api.example.com/api/integration/jira/webhook/abc123');
		// The id extends the path, never a query or a fragment of the base address.
		const queried = readJiraConfig({ JIRA_CLIENT_ID: 'id', JIRA_CLIENT_SECRET: 'secret', API_BASE_URL: 'https://api.example.com', JIRA_WEBHOOK_URL: 'https://hooks.example.com/jira/?source=jira' });
		expect(jiraWebhookTargetOf(queried, 'abc123')).toBe('https://hooks.example.com/jira/abc123?source=jira');
	});

	it('reads the import interval as whole minutes, 0 switching the scheduled import off, and keeps the default otherwise', () => {
		const warn = jest.fn();
		expect(readJiraConfig({}).importIntervalMinutes).toBe(15);
		expect(readJiraConfig({ JIRA_IMPORT_INTERVAL_MINUTES: ' 30 ' }).importIntervalMinutes).toBe(30);
		expect(readJiraConfig({ JIRA_IMPORT_INTERVAL_MINUTES: '0' }).importIntervalMinutes).toBe(0);
		expect(jiraImportIntervalOf('1.5', warn)).toBe(15);
		expect(jiraImportIntervalOf('-5', warn)).toBe(15);
		expect(warn).toHaveBeenCalledTimes(2);
	});

	it('prefers the explicit URLs and refuses unusable ones', () => {
		const warn = jest.fn();
		const config = readJiraConfig({ JIRA_REDIRECT_URL: 'https://other.example.com/cb', JIRA_POST_INSTALL_URL: 'not a url' }, warn);
		expect(config.redirectUrl).toBe('https://other.example.com/cb');
		expect(config.postInstallUrl).toBeNull();
		expect(warn).toHaveBeenCalledTimes(1);
		expect(isJiraConfigured(config)).toBe(false);
	});

	it('keeps webhooks off without the app, or on an address Jira does not deliver to (plain HTTP)', () => {
		const app = { JIRA_CLIENT_ID: 'id', JIRA_CLIENT_SECRET: 'secret', API_BASE_URL: 'http://localhost:3000' };
		expect(jiraWebhooksEnabled(readJiraConfig(app))).toBe(false);
		expect(jiraWebhookTargetOf(readJiraConfig(app), 'x')).toBeNull();
		expect(jiraWebhooksEnabled(readJiraConfig({ ...app, JIRA_WEBHOOK_URL: 'https://hooks.example.com/jira' }))).toBe(true);
		expect(jiraWebhooksEnabled(readJiraConfig({ JIRA_WEBHOOK_URL: 'https://hooks.example.com/jira' }))).toBe(false);
	});
});
