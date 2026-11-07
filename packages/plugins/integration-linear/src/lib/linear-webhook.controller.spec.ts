import { createHmac } from 'node:crypto';
import { isLinearSignatureValid, isLinearTimestampFresh, issueOfDelivery } from './linear-webhook.controller';

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

	it('names the issue a delivery is about: itself, or the one a comment or attachment belongs to; nothing for a removal', () => {
		expect(issueOfDelivery({ type: 'Issue', action: 'update', data: { id: 'i1', teamId: 't1' } })).toEqual({ issueId: 'i1', teamId: 't1' });
		expect(issueOfDelivery({ type: 'Issue', action: 'create', data: { id: 'i1', team: { id: 't1' } } })).toEqual({ issueId: 'i1', teamId: 't1' });
		expect(issueOfDelivery({ type: 'Comment', action: 'create', data: { id: 'c1', issueId: 'i2', issue: { id: 'i2', teamId: 't2' } } })).toEqual({ issueId: 'i2', teamId: 't2' });
		expect(issueOfDelivery({ type: 'Comment', action: 'update', data: { id: 'c1', issue: { id: 'i2' } } })).toEqual({ issueId: 'i2', teamId: null });
		expect(issueOfDelivery({ type: 'Attachment', action: 'create', data: { id: 'a1', issueId: 'i3' } })).toEqual({ issueId: 'i3', teamId: null });
		expect(issueOfDelivery({ type: 'Comment', action: 'remove', data: { id: 'c1', issueId: 'i2' } })).toBeNull();
		expect(issueOfDelivery({ type: 'Project', action: 'update', data: { id: 'p1' } })).toBeNull();
		expect(issueOfDelivery({ type: 'Issue', action: 'update', data: {} })).toBeNull();
	});
});
