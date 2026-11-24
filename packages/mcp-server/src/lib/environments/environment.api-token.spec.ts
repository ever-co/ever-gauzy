import type { IEnvironment } from './ienvironment';

// No .env file of the machine running the tests may add or hide a setting
jest.mock('dotenv', () => ({ config: () => ({ error: new Error('not read in tests') }) }));

const mockCreateClient = jest.fn();
jest.mock('axios', () => ({
	__esModule: true,
	default: { create: (...args: unknown[]) => mockCreateClient(...args) }
}));

// Every module loads its own copy of the logger here: each copy writes down what it is given
const mockPrinted: unknown[][] = [];
jest.mock('@nestjs/common', () => {
	const record = (...args: unknown[]) => {
		mockPrinted.push(args);
	};
	class RecordingLogger {
		log = record;
		warn = record;
		error = record;
		debug = record;
	}
	return { ...jest.requireActual('@nestjs/common'), Logger: RecordingLogger };
});

const TOKEN = `gzp_${'A1b2-C3d4_'.repeat(4)}xyz`;
const ENVIRONMENT_FILES = ['./environment', './environment.prod'] as const;
const SETTINGS = ['GAUZY_API_TOKEN', 'GAUZY_AUTO_LOGIN', 'GAUZY_AUTH_EMAIL', 'GAUZY_AUTH_PASSWORD'] as const;

/** The environment module as the server loads it at start, with these settings */
function loadEnvironment(file: (typeof ENVIRONMENT_FILES)[number], settings: Record<string, string>): IEnvironment {
	for (const [name, value] of Object.entries(settings)) {
		process.env[name] = value;
	}
	let environment: IEnvironment;
	jest.isolateModules(() => {
		environment = require(file).environment;
	});
	return environment;
}

/** Everything the loggers printed, as one text */
function printed(): string {
	return JSON.stringify(mockPrinted);
}

describe('environment: GAUZY_API_TOKEN', () => {
	const saved = Object.fromEntries(SETTINGS.map((name) => [name, process.env[name]]));
	let exit: jest.SpyInstance;

	beforeEach(() => {
		for (const name of SETTINGS) {
			delete process.env[name];
		}
		mockCreateClient.mockReset();
		mockPrinted.length = 0;
		// The production environment exits on a bad setting: here that ends the test, not the run
		exit = jest.spyOn(process, 'exit').mockImplementation((code) => {
			throw new Error(`process.exit(${code})`);
		});
	});
	afterEach(() => {
		for (const [name, value] of Object.entries(saved)) {
			if (value === undefined) {
				delete process.env[name];
			} else {
				process.env[name] = value;
			}
		}
		jest.restoreAllMocks();
	});

	it.each(ENVIRONMENT_FILES)('signs in at start with a token alone, without GAUZY_AUTO_LOGIN (%s)', (file) => {
		const environment = loadEnvironment(file, { GAUZY_API_TOKEN: TOKEN });

		expect(environment.auth.apiToken).toBe(TOKEN);
		expect(environment.auth.autoLogin).toBe(true);
	});

	it.each(ENVIRONMENT_FILES)('needs no email or password with GAUZY_AUTO_LOGIN on and a token (%s)', (file) => {
		const environment = loadEnvironment(file, { GAUZY_API_TOKEN: TOKEN, GAUZY_AUTO_LOGIN: 'true' });

		expect(environment.auth).toEqual({ email: '', password: '', apiToken: TOKEN, autoLogin: true });
	});

	it('drops the spaces a copy and paste adds around the token', () => {
		const environment = loadEnvironment('./environment', { GAUZY_API_TOKEN: ` ${TOKEN}\n` });

		expect(environment.auth.apiToken).toBe(TOKEN);
	});

	it('refuses a value without the shape of a token at start, before any request, and never prints it', () => {
		const malformed = 'my-secret-password';
		process.env.GAUZY_API_TOKEN = malformed;

		expect(() => jest.isolateModules(() => require('../common/api-client'))).toThrow(
			'Invalid environment configuration'
		);
		expect(mockCreateClient).not.toHaveBeenCalled();
		expect(printed()).toContain('GAUZY_API_TOKEN does not look like a Gauzy API token');
		expect(printed()).not.toContain(malformed);
	});

	it('refuses a token cut short in production too, and never prints it', () => {
		const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		const cutShort = TOKEN.slice(0, -1);

		expect(() => loadEnvironment('./environment.prod', { GAUZY_API_TOKEN: cutShort })).toThrow('process.exit(1)');
		expect(exit).toHaveBeenCalledWith(1);
		expect(JSON.stringify(errors.mock.calls)).toContain('GAUZY_API_TOKEN does not look like a Gauzy API token');
		expect(JSON.stringify(errors.mock.calls)).not.toContain(cutShort);
	});

	describe('without a token, nothing changes', () => {
		it.each(ENVIRONMENT_FILES)('keeps auto-login off and the token empty (%s)', (file) => {
			const environment = loadEnvironment(file, {
				GAUZY_AUTH_EMAIL: 'operator@example.com',
				GAUZY_AUTH_PASSWORD: 'operator-password'
			});

			expect(environment.auth).toEqual({
				email: 'operator@example.com',
				password: 'operator-password',
				apiToken: '',
				autoLogin: false
			});
		});

		it('still needs an email and a password with GAUZY_AUTO_LOGIN on', () => {
			expect(() => loadEnvironment('./environment', { GAUZY_AUTO_LOGIN: 'true' })).toThrow(
				'Invalid environment configuration'
			);
			expect(printed()).toContain('GAUZY_AUTH_EMAIL is required when GAUZY_AUTO_LOGIN is enabled');
			expect(printed()).toContain('GAUZY_AUTH_PASSWORD is required when GAUZY_AUTO_LOGIN is enabled');
		});

		it('ignores an empty GAUZY_API_TOKEN', () => {
			const environment = loadEnvironment('./environment', { GAUZY_API_TOKEN: '  ' });

			expect(environment.auth.apiToken).toBe('');
			expect(environment.auth.autoLogin).toBe(false);
		});
	});
});

