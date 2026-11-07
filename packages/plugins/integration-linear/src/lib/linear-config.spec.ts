import { isLinearConfigured, readLinearConfig } from './linear-config';

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
