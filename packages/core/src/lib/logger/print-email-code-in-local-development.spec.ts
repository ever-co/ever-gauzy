jest.mock('@gauzy/config', () => ({
	isDevelopment: jest.fn(),
	environment: { baseUrl: '', clientBaseUrl: '' }
}));

import { environment, isDevelopment } from '@gauzy/config';
import { printEmailCodeInLocalDevelopment } from './print-email-code-in-local-development';

describe('printEmailCodeInLocalDevelopment', () => {
	const LINE = '[DEV] Sign-in code for person@ever.co: ABC123';
	const logger = { log: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
	const savedNodeEnv = process.env.NODE_ENV;
	const savedOptIn = process.env.PRINT_EMAIL_CODES;

	function restoreEnv(name: string, value: string | undefined): void {
		if (value === undefined) {
			delete process.env[name];
			return;
		}
		process.env[name] = value;
	}

	function serveFrom(apiUrl: string, appUrl: string): void {
		environment.baseUrl = apiUrl;
		environment.clientBaseUrl = appUrl;
	}

	/** A production build run with NODE_ENV=`nodeEnv` and PRINT_EMAIL_CODES=`optIn`. */
	function runProductionBuild(nodeEnv: string, optIn: string): void {
		(isDevelopment as jest.Mock).mockReturnValue(false);
		process.env.NODE_ENV = nodeEnv;
		process.env.PRINT_EMAIL_CODES = optIn;
	}

	function printSignInCode(code?: string): void {
		printEmailCodeInLocalDevelopment(logger, 'Sign-in code', 'person@ever.co', code);
	}

	beforeEach(() => {
		jest.clearAllMocks();
		(isDevelopment as jest.Mock).mockReturnValue(true);
		delete process.env.PRINT_EMAIL_CODES;
		serveFrom('http://localhost:3000', 'http://localhost:4200');
	});

	afterEach(() => {
		restoreEnv('NODE_ENV', savedNodeEnv);
		restoreEnv('PRINT_EMAIL_CODES', savedOptIn);
	});

	it('prints one line with the label, the recipient and the code on a local development instance', () => {
		printSignInCode('ABC123');

		expect(logger.log).toHaveBeenCalledTimes(1);
		expect(logger.log).toHaveBeenCalledWith(LINE);
	});

	it.each([
		['a name ending in .localhost', 'http://api.localhost:3000', 'http://app.localhost:4200'],
		['127.0.0.1', 'http://127.0.0.1:3000', 'http://127.0.0.1:4200'],
		['::1', 'http://[::1]:3000', 'http://[::1]:4200'],
		['a 10.0.0.0/8 address', 'http://10.1.2.3:3000', 'http://10.1.2.3:4200'],
		['a 172.16.0.0/12 address', 'http://172.20.0.3:3000', 'http://172.20.0.3:4200'],
		['a 192.168.0.0/16 address', 'http://192.168.1.20:3000', 'http://192.168.1.20:4200']
	])('prints on a development build served from %s', (_case, apiUrl, appUrl) => {
		serveFrom(apiUrl, appUrl);

		printSignInCode('ABC123');

		expect(logger.log).toHaveBeenCalledWith(LINE);
	});

	it.each([
		['the public demo', 'https://apidemo.gauzy.co', 'https://demo.gauzy.co'],
		['a public API', 'https://api.example.org', 'http://localhost:4200'],
		['a public app', 'http://localhost:3000', 'https://app.example.org'],
		['a 100.64.0.0/10 address', 'http://100.64.0.1:3000', 'http://100.64.0.1:4200'],
		['a 169.254.0.0/16 address', 'http://169.254.10.20:3000', 'http://169.254.10.20:4200'],
		['a 172.32 address, outside 172.16.0.0/12', 'http://172.32.0.1:3000', 'http://172.32.0.1:4200'],
		['a name that only starts with localhost', 'http://localhost.example.org', 'http://localhost:4200'],
		['a base URL without a host', 'localhost:3000', 'http://localhost:4200']
	])('prints nothing on a development build served from %s', (_case, apiUrl, appUrl) => {
		serveFrom(apiUrl, appUrl);

		printSignInCode('ABC123');

		expect(logger.log).not.toHaveBeenCalled();
	});

	it('prints nothing on a production build without the opt-in', () => {
		(isDevelopment as jest.Mock).mockReturnValue(false);
		process.env.NODE_ENV = 'development';

		printSignInCode('ABC123');

		expect(logger.log).not.toHaveBeenCalled();
	});

	it.each([
		['localhost', 'http://localhost:3000', 'http://localhost:4200'],
		['::1', 'http://[::1]:3000', 'http://[::1]:4200']
	])('prints on a production build that opted in, run with NODE_ENV=development on %s', (_case, apiUrl, appUrl) => {
		runProductionBuild('development', 'true');
		serveFrom(apiUrl, appUrl);

		printSignInCode('ABC123');

		expect(logger.log).toHaveBeenCalledWith(LINE);
	});

	it.each([
		['a 192.168.0.0/16 address', 'development', 'true', 'http://192.168.1.20:3000', 'http://192.168.1.20:4200'],
		['NODE_ENV=production', 'production', 'true', 'http://localhost:3000', 'http://localhost:4200'],
		[
			"PRINT_EMAIL_CODES=TRUE, not exactly 'true'",
			'development',
			'TRUE',
			'http://localhost:3000',
			'http://localhost:4200'
		],
		[
			"PRINT_EMAIL_CODES=1, not exactly 'true'",
			'development',
			'1',
			'http://localhost:3000',
			'http://localhost:4200'
		]
	])('prints nothing on a production build with the opt-in and %s', (_case, nodeEnv, optIn, apiUrl, appUrl) => {
		runProductionBuild(nodeEnv, optIn);
		serveFrom(apiUrl, appUrl);

		printSignInCode('ABC123');

		expect(logger.log).not.toHaveBeenCalled();
	});

	it.each([undefined, ''])('prints nothing without a code or a link (%p)', (code) => {
		printSignInCode(code);

		expect(logger.log).not.toHaveBeenCalled();
	});
});
