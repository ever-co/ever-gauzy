import { sanitizeErrorMessage, sanitizeForLogging } from './error-utils';

const TOKEN = `gzp_${'A1b2-C3d4_'.repeat(4)}xyz`;

/**
 * A personal API token is a credential: a message or a log line that quotes one hands it to whoever reads it. Its
 * secret holds `-` and `_`, so the redaction of long alphanumeric keys missed it.
 */
describe('error-utils: personal API tokens', () => {
	it('removes a token from an error message', () => {
		const message = sanitizeErrorMessage(new Error(`exchange failed for ${TOKEN}`));

		expect(message).toBe('exchange failed for [API_TOKEN]');
	});

	it('removes a token from a text or an error written to the log', () => {
		expect(sanitizeForLogging(`GAUZY_API_TOKEN=${TOKEN}`)).toBe('GAUZY_API_TOKEN=[API_TOKEN]');
		expect(sanitizeForLogging(new Error(`refused: ${TOKEN}`))).not.toContain(TOKEN);
	});

	it('removes a token from any field of an object written to the log', () => {
		const logged = sanitizeForLogging({ request: { body: `{"value":"${TOKEN}"}` }, notes: [TOKEN] });

		expect(logged).not.toContain(TOKEN);
		expect(logged).not.toContain('gzp_');
	});

	it('removes a token cut short too', () => {
		expect(sanitizeErrorMessage(`token ${TOKEN.slice(0, 12)}`)).toBe('token [API_TOKEN]');
	});

	it('CONTROL: leaves a text without a token as it was', () => {
		expect(sanitizeErrorMessage('Request failed with status code 401')).toBe('Request failed with status code 401');
	});
});
