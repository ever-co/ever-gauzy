import { sanitizeErrorMessage } from './error-utils';

/**
 * A request the API refused reached the assistant as "Request failed with status code 400" alone, while the API had
 * answered why: the field and the values it accepts, or the right a role misses (#12104). The tools throw the message
 * this helper gives, so it now carries the API's reason after the HTTP client's own message.
 */

/** An error as the HTTP client throws it for a refused request: its own message, and the API's answer. */
const refused = (status: number, data: unknown) =>
	Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } });

describe("error-utils: the API's reason for a refused request", () => {
	it('adds the reasons the validation lists', () => {
		const error = refused(400, {
			statusCode: 400,
			message: ['paymentMethod must be one of the following values: BANK_TRANSFER, CASH, CHEQUE']
		});

		expect(sanitizeErrorMessage(error)).toBe(
			'Request failed with status code 400: paymentMethod must be one of the following values: BANK_TRANSFER, CASH, CHEQUE'
		);
	});

	it('joins several reasons', () => {
		const error = refused(400, { message: ['amount must be a number', 'currency should not be empty'] });

		expect(sanitizeErrorMessage(error)).toBe(
			'Request failed with status code 400: amount must be a number; currency should not be empty'
		);
	});

	it("adds the reason of a refusal for a person's role", () => {
		const error = refused(403, {
			statusCode: 403,
			message: 'You can only read the daily plans of a team you belong to'
		});

		expect(sanitizeErrorMessage(error)).toBe(
			'Request failed with status code 403: You can only read the daily plans of a team you belong to'
		);
	});

	it('removes a credential the reason quotes', () => {
		const token = `gzp_${'A1b2-C3d4_'.repeat(4)}xyz`;

		expect(sanitizeErrorMessage(refused(401, { message: `unknown token ${token}` }))).toBe(
			'Request failed with status code 401: unknown token [API_TOKEN]'
		);
	});

	it('CONTROL: keeps the message alone when the answer gives no reason', () => {
		expect(sanitizeErrorMessage(refused(502, '<html>Bad Gateway</html>'))).toBe(
			'Request failed with status code 502'
		);
		expect(sanitizeErrorMessage(refused(500, { statusCode: 500 }))).toBe('Request failed with status code 500');
		expect(sanitizeErrorMessage(new Error('Organization ID not available'))).toBe('Organization ID not available');
	});
});
