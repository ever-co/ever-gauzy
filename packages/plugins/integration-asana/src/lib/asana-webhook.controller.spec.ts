import { createHmac } from 'node:crypto';
import { isAsanaSignatureValid, isHandshakeAccepted, taskGidsOf } from './asana-webhook.controller';

describe('Asana webhook checks', () => {
	it('accepts a handshake only with the token of a registration in flight, within its window', () => {
		const started = new Date('2026-11-07T10:00:00.000Z');
		const now = started.getTime() + 60_000;
		const open = { webhookHandshakeToken: 'tok-1', webhookHandshakeStartedAt: started };
		expect(isHandshakeAccepted(open, 'tok-1', now)).toBe(true);
		expect(isHandshakeAccepted(open, 'tok-2', now)).toBe(false);
		expect(isHandshakeAccepted(open, undefined, now)).toBe(false);
		expect(isHandshakeAccepted(open, 'tok-1', now + 11 * 60_000)).toBe(false);
		expect(isHandshakeAccepted({ webhookHandshakeToken: null, webhookHandshakeStartedAt: null }, 'tok-1', now)).toBe(false);
		expect(isHandshakeAccepted({ webhookHandshakeToken: 'tok-1', webhookHandshakeStartedAt: null }, 'tok-1', now)).toBe(false);
	});

	const secret = 'hook-secret';
	const body = Buffer.from(JSON.stringify({ events: [{ action: 'changed', resource: { gid: 't1', resource_type: 'task' } }] }));

	it('accepts the hex HMAC-SHA256 of the raw body, in either case', () => {
		const signature = createHmac('sha256', secret).update(body).digest('hex');
		expect(isAsanaSignatureValid(secret, body, signature)).toBe(true);
		expect(isAsanaSignatureValid(secret, body, signature.toUpperCase())).toBe(true);
	});

	it('refuses a missing, malformed, foreign or tampered signature', () => {
		const signature = createHmac('sha256', secret).update(body).digest('hex');
		expect(isAsanaSignatureValid(secret, body, undefined)).toBe(false);
		expect(isAsanaSignatureValid(secret, body, 'nope')).toBe(false);
		expect(isAsanaSignatureValid('other', body, signature)).toBe(false);
		expect(isAsanaSignatureValid(secret, Buffer.concat([body, Buffer.from(' ')]), signature)).toBe(false);
	});

	it('names the tasks of the events that add, change or undelete a task, or a comment or attachment of one, each once', () => {
		expect(
			taskGidsOf([
				{ action: 'changed', resource: { gid: 't1', resource_type: 'task' } },
				{ action: 'added', resource: { gid: 't2', resource_type: 'task' } },
				{ action: 'changed', resource: { gid: 't1', resource_type: 'task' } },
				{ action: 'deleted', resource: { gid: 't3', resource_type: 'task' } },
				{ action: 'changed', resource: { gid: 's1', resource_type: 'story' } },
				{ action: 'added', resource: { gid: 's2', resource_type: 'story', resource_subtype: 'comment_added' }, parent: { gid: 't5', resource_type: 'task' } },
				{ action: 'added', resource: { gid: 'a1', resource_type: 'attachment' }, parent: { gid: 't6', resource_type: 'task' } },
				{ action: 'removed', resource: { gid: 'a2', resource_type: 'attachment' }, parent: { gid: 't7', resource_type: 'task' } },
				{ action: 'undeleted', resource: { gid: 't4', resource_type: 'task' } }
			])
		).toEqual(['t1', 't2', 't5', 't6', 't4']);
		expect(taskGidsOf(undefined)).toEqual([]);
	});
});
