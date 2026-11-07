import { createHmac } from 'node:crypto';
import { isAsanaSignatureValid, taskGidsOf } from './asana-webhook.controller';

describe('Asana webhook checks', () => {
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

	it('names the tasks of the events that add, change or undelete a task, each once', () => {
		expect(
			taskGidsOf([
				{ action: 'changed', resource: { gid: 't1', resource_type: 'task' } },
				{ action: 'added', resource: { gid: 't2', resource_type: 'task' } },
				{ action: 'changed', resource: { gid: 't1', resource_type: 'task' } },
				{ action: 'deleted', resource: { gid: 't3', resource_type: 'task' } },
				{ action: 'changed', resource: { gid: 's1', resource_type: 'story' } },
				{ action: 'undeleted', resource: { gid: 't4', resource_type: 'task' } }
			])
		).toEqual(['t1', 't2', 't4']);
		expect(taskGidsOf(undefined)).toEqual([]);
	});
});
