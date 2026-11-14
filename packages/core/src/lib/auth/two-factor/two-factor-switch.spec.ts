import { isTwoFactorEnrolmentOpen, TWO_FACTOR_ENV } from './two-factor-switch';

/**
 * The operator's switch of ever-co/ever-gauzy#11916 is off unless set: a server that never heard of it keeps everyone
 * from turning two-factor authentication on.
 */
describe('isTwoFactorEnrolmentOpen', () => {
	const previous = process.env[TWO_FACTOR_ENV];

	afterEach(() => {
		if (previous === undefined) {
			delete process.env[TWO_FACTOR_ENV];
		} else {
			process.env[TWO_FACTOR_ENV] = previous;
		}
	});

	it('is off on a server that does not set TWO_FACTOR_ENABLED', () => {
		delete process.env[TWO_FACTOR_ENV];

		expect(isTwoFactorEnrolmentOpen()).toBe(false);
	});

	it('reads TWO_FACTOR_ENABLED', () => {
		process.env[TWO_FACTOR_ENV] = 'true';

		expect(isTwoFactorEnrolmentOpen()).toBe(true);
	});

	it.each(['true', 'TRUE', ' true ', '1', 'yes', 'on'])('is on for %p', (value) => {
		expect(isTwoFactorEnrolmentOpen(value)).toBe(true);
	});

	it.each(['', 'false', '0', 'no', 'off', 'enabled'])('is off for %p', (value) => {
		expect(isTwoFactorEnrolmentOpen(value)).toBe(false);
	});
});
