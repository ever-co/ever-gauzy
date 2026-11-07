import { isLinearConfigured, readLinearConfig, linearImportIntervalOf } from './linear-config';

describe('readLinearConfig', () => {
	it('derives the callback and the post-install page from the platform URLs', () => {
		const config = readLinearConfig({
			LINEAR_CLIENT_ID: 'id',
			LINEAR_CLIENT_SECRET: 'secret',
			API_BASE_URL: 'https://api.example.com/',
			CLIENT_BASE_URL: 'https://app.example.com'
		});
		expect(config.redirectUrl).toBe('https://api.example.com/api/integration/linear/callback');
		expect(config.postInstallUrl).toBe('https://app.example.com/#/pages/integrations/linear');
		expect(config.apiUrl).toBe('https://api.linear.app/graphql');
		expect(isLinearConfigured(config)).toBe(true);
	});

	it('reads the import interval as whole minutes, 0 switching the scheduled import off, and keeps the default otherwise', () => {
		const warn = jest.fn();
		expect(readLinearConfig({}).importIntervalMinutes).toBe(15);
		expect(readLinearConfig({ LINEAR_IMPORT_INTERVAL_MINUTES: ' 30 ' }).importIntervalMinutes).toBe(30);
		expect(readLinearConfig({ LINEAR_IMPORT_INTERVAL_MINUTES: '0' }).importIntervalMinutes).toBe(0);
		expect(linearImportIntervalOf('1.5', warn)).toBe(15);
		expect(linearImportIntervalOf('-5', warn)).toBe(15);
		expect(warn).toHaveBeenCalledTimes(2);
	});

	it('prefers the explicit URLs and refuses unusable ones', () => {
		const warn = jest.fn();
		const config = readLinearConfig(
			{ LINEAR_REDIRECT_URL: 'https://other.example.com/cb', LINEAR_POST_INSTALL_URL: 'not a url', LINEAR_WEBHOOK_SECRET: ' s ' },
			warn
		);
		expect(config.redirectUrl).toBe('https://other.example.com/cb');
		expect(config.postInstallUrl).toBeNull();
		expect(config.webhookSecret).toBe('s');
		expect(warn).toHaveBeenCalledTimes(1);
		expect(isLinearConfigured(config)).toBe(false);
	});
});
