jest.mock('dotenv', () => ({
	config: jest.fn(() => ({ parsed: {} }))
}));

import { isEnvFlagEnabled, parseNonNegativeInt, resolveAppLink } from './environment.helper';

describe('parseNonNegativeInt', () => {
	it('parses a plain non-negative integer, keeping an explicit 0', () => {
		expect(parseNonNegativeInt('10', 5)).toBe(10);
		expect(parseNonNegativeInt(' 900 ', 5)).toBe(900);
		expect(parseNonNegativeInt('0', 5)).toBe(0);
	});

	it('uses the fallback when the value is unset or blank', () => {
		expect(parseNonNegativeInt(undefined, 5)).toBe(5);
		expect(parseNonNegativeInt('', 5)).toBe(5);
		expect(parseNonNegativeInt('   ', 5)).toBe(5);
	});

	it('rejects a value that merely STARTS with digits instead of reading its prefix', () => {
		// `Number.parseInt('0oops', 10)` is 0, which would have switched AUTH_MAX_FAILED_ATTEMPTS off.
		expect(parseNonNegativeInt('0oops', 10)).toBe(10);
		expect(parseNonNegativeInt('10oops', 5)).toBe(5);
		expect(parseNonNegativeInt('1e3', 5)).toBe(5);
		expect(parseNonNegativeInt('12.5', 5)).toBe(5);
	});

	it('rejects negative, signed and unsafe values', () => {
		expect(parseNonNegativeInt('-1', 5)).toBe(5);
		expect(parseNonNegativeInt('+3', 5)).toBe(5);
		expect(parseNonNegativeInt('99999999999999999999', 5)).toBe(5);
	});
});

describe('isEnvFlagEnabled', () => {
	const KEYS = ['GAUZY_TEST_FLAG_A', 'GAUZY_TEST_FLAG_B'];

	afterEach(() => {
		for (const key of KEYS) {
			delete process.env[key];
		}
	});

	it('is on only for an explicit affirmative value', () => {
		process.env.GAUZY_TEST_FLAG_A = ' TRUE ';
		expect(isEnvFlagEnabled('GAUZY_TEST_FLAG_A')).toBe(true);

		process.env.GAUZY_TEST_FLAG_A = 'enabled';
		expect(isEnvFlagEnabled('GAUZY_TEST_FLAG_A')).toBe(false);

		delete process.env.GAUZY_TEST_FLAG_A;
		expect(isEnvFlagEnabled('GAUZY_TEST_FLAG_A')).toBe(false);
	});

	it('takes the first key that carries a value', () => {
		process.env.GAUZY_TEST_FLAG_A = 'false';
		process.env.GAUZY_TEST_FLAG_B = 'true';
		expect(isEnvFlagEnabled('GAUZY_TEST_FLAG_A', 'GAUZY_TEST_FLAG_B')).toBe(false);

		delete process.env.GAUZY_TEST_FLAG_A;
		expect(isEnvFlagEnabled('GAUZY_TEST_FLAG_A', 'GAUZY_TEST_FLAG_B')).toBe(true);
	});
});

describe('resolveAppLink', () => {
	const saved = { APP_LINK: process.env['APP_LINK'], CLIENT_BASE_URL: process.env['CLIENT_BASE_URL'] };

	afterEach(() => {
		for (const [key, value] of Object.entries(saved)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	});

	it('uses APP_LINK when it holds a value', () => {
		process.env['APP_LINK'] = 'https://example.test/app/';
		process.env['CLIENT_BASE_URL'] = 'https://other.test';
		expect(resolveAppLink('http://localhost:4200/')).toBe('https://example.test/app/');
	});

	it('derives the link from CLIENT_BASE_URL when APP_LINK is empty - the hosted deployments case', () => {
		// app.gauzy.co carries APP_LINK as an empty key; the fallback used to win and every welcome
		// email footer pointed at http://localhost:4200/.
		process.env['APP_LINK'] = '';
		process.env['CLIENT_BASE_URL'] = 'https://app.gauzy.co';
		expect(resolveAppLink('http://localhost:4200/')).toBe('https://app.gauzy.co/');
	});

	it('does not double the trailing slash and ignores whitespace', () => {
		delete process.env['APP_LINK'];
		process.env['CLIENT_BASE_URL'] = '  https://stage.gauzy.co//  ';
		expect(resolveAppLink('http://localhost:4200/')).toBe('https://stage.gauzy.co/');
	});

	it('falls back only when neither variable is set', () => {
		delete process.env['APP_LINK'];
		delete process.env['CLIENT_BASE_URL'];
		expect(resolveAppLink('http://localhost:4200/')).toBe('http://localhost:4200/');
		process.env['APP_LINK'] = '   ';
		expect(resolveAppLink('https://app.gauzy.co/')).toBe('https://app.gauzy.co/');
	});
});
