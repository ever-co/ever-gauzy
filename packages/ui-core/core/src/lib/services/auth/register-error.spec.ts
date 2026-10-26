import { readRegisterError } from './register-error';

describe('readRegisterError', () => {
	const checkoutUrl = 'https://ever.co/checkout?email=jane%40corp.co';

	it('reads the subscription-required answer: its message and where to buy', () => {
		const error = {
			status: 403,
			error: { message: 'A subscription is required to create an account.', checkoutUrl }
		};
		expect(readRegisterError(error)).toEqual({
			messages: ['A subscription is required to create an account.'],
			checkoutUrl
		});
	});

	it('reads class-validator style message arrays and drops blanks', () => {
		const error = { status: 400, error: { message: ['email must be an email', '  ', 3] } };
		expect(readRegisterError(error)).toEqual({ messages: ['email must be an email'], checkoutUrl: null });
	});

	it('ignores a 5xx body, which can carry internal detail', () => {
		const error = { status: 500, error: { message: 'relation "user" does not exist', checkoutUrl } };
		expect(readRegisterError(error)).toEqual({ messages: null, checkoutUrl: null });
	});

	it('never turns a non-http(s) or relative checkoutUrl into a link', () => {
		for (const bad of ['javascript:alert(1)', '/checkout', 'data:text/html,x', 42]) {
			const error = { status: 403, error: { message: 'Subscription required', checkoutUrl: bad } };
			expect(readRegisterError(error).checkoutUrl).toBeNull();
		}
	});

	it('returns nothing for errors without an HTTP answer (network failure, thrown Error)', () => {
		expect(readRegisterError(new Error('offline'))).toEqual({ messages: null, checkoutUrl: null });
		expect(readRegisterError(undefined)).toEqual({ messages: null, checkoutUrl: null });
		expect(readRegisterError({ status: 0, error: new ProgressEvent('error') })).toEqual({
			messages: null,
			checkoutUrl: null
		});
	});
});
