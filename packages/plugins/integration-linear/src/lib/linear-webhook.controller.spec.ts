import { createHmac } from 'node:crypto';
import { isLinearSignatureValid, isLinearTimestampFresh } from './linear-webhook.controller';

describe('Linear webhook checks', () => {
	const secret = 'signing-secret';
	const body = Buffer.from(JSON.stringify({ action: 'update', type: 'Issue', data: { id: 'i1' } }));

	it('accepts the hex HMAC-SHA256 of the raw body, in either case', () => {
		const signature = createHmac('sha256', secret).update(body).digest('hex');
		expect(isLinearSignatureValid(secret, body, signature)).toBe(true);
		expect(isLinearSignatureValid(secret, body, signature.toUpperCase())).toBe(true);
	});

	it('refuses a missing, malformed, foreign or tampered signature', () => {
		const signature = createHmac('sha256', secret).update(body).digest('hex');
		expect(isLinearSignatureValid(secret, body, undefined)).toBe(false);
		expect(isLinearSignatureValid(secret, body, 'nope')).toBe(false);
		expect(isLinearSignatureValid('other', body, signature)).toBe(false);
		expect(isLinearSignatureValid(secret, Buffer.concat([body, Buffer.from(' ')]), signature)).toBe(false);
	});

	it('accepts a timestamp within the tolerance only', () => {
		const now = 1_800_000_000_000;
		expect(isLinearTimestampFresh(now - 30_000, now)).toBe(true);
		expect(isLinearTimestampFresh(now - 90_000, now)).toBe(false);
		expect(isLinearTimestampFresh(undefined, now)).toBe(false);
	});
});
