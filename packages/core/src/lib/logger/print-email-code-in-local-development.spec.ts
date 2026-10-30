jest.mock('@gauzy/config', () => ({
	isDevelopment: jest.fn(),
	environment: { baseUrl: '', clientBaseUrl: '' }
}));

import { environment, isDevelopment } from '@gauzy/config';
import { printEmailCodeInLocalDevelopment } from './print-email-code-in-local-development';

describe('printEmailCodeInLocalDevelopment', () => {
	const logger = { log: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };

	function serveFrom(apiUrl: string, appUrl: string): void {
		environment.baseUrl = apiUrl;
		environment.clientBaseUrl = appUrl;
	}

	function printSignInCode(code?: string): void {
		printEmailCodeInLocalDevelopment(logger, 'Sign-in code', 'person@ever.co', code);
	}

	beforeEach(() => {
		jest.clearAllMocks();
		(isDevelopment as jest.Mock).mockReturnValue(true);
		serveFrom('http://localhost:3000', 'http://localhost:4200');
	});

	it('prints one line with the label, the recipient and the code on a local development instance', () => {
		printSignInCode('ABC123');

		expect(logger.log).toHaveBeenCalledTimes(1);
		expect(logger.log).toHaveBeenCalledWith('[DEV] Sign-in code for person@ever.co: ABC123');
	});

	it('prints on a development instance served from a private network', () => {
		serveFrom('http://192.168.1.20:3000', 'http://192.168.1.20:4200');

		printSignInCode('ABC123');

		expect(logger.log).toHaveBeenCalledWith('[DEV] Sign-in code for person@ever.co: ABC123');
	});

	it('prints nothing outside development', () => {
		(isDevelopment as jest.Mock).mockReturnValue(false);

		printSignInCode('ABC123');

		expect(logger.log).not.toHaveBeenCalled();
	});

	it.each([
		['the public demo', 'https://apidemo.gauzy.co', 'https://demo.gauzy.co'],
		['a public API', 'https://api.example.org', 'http://localhost:4200'],
		['a public app', 'http://localhost:3000', 'https://app.example.org'],
		['a base URL without a host', 'localhost:3000', 'http://localhost:4200']
	])('prints nothing on a development instance served from %s', (_case, apiUrl, appUrl) => {
		serveFrom(apiUrl, appUrl);

		printSignInCode('ABC123');

		expect(logger.log).not.toHaveBeenCalled();
	});

	it.each([undefined, ''])('prints nothing without a code or a link (%p)', (code) => {
		printSignInCode(code);

		expect(logger.log).not.toHaveBeenCalled();
	});
});
