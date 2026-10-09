// cspell:ignore evit
import { AUDIT_ACTIONS, AuditEntryRefusedError, EverConnectAuditService } from './ever-connect-audit.service';

/**
 * The audit records each action with ids and states only: a `details` key outside the allow-list,
 * or a value that looks like an address, is refused; and the service has no way to change a row
 * (rows are removed only with a deleted Gauzy organization or tenant).
 */
describe('Ever Platform audit entries', () => {
	it.each(AUDIT_ACTIONS.map((action) => [action]))('%s with id-only details is accepted', (action) => {
		expect(() =>
			EverConnectAuditService.check({
				action,
				actorLabel: 'operator',
				details: { link_id: '01JD4M2N3P4Q5R6S7T8V9V0W1X', state: 'enabled', seq: 3 }
			})
		).not.toThrow();
	});

	it.each([
		['an e-mail key', { email: 'ops@example.test' }],
		['a code key', { code: 'EVC-AAAA-BBBB-CCCC' }],
		['a token key', { token: 'evit_x' }],
		['an IP address key', { ip: '203.0.113.7' }],
		['a user agent key', { user_agent: 'Mozilla' }],
		['an address in an allowed key', { reason: 'ops@example.test' }],
		['a URL in an allowed key', { reason: 'https://gauzy.example.test' }],
		['an object value', { state: { nested: true } }]
	])('%s is refused', (_name, details) => {
		expect(() =>
			EverConnectAuditService.check({
				action: 'instance.connect',
				actorLabel: 'operator',
				details: details as never
			})
		).toThrow(AuditEntryRefusedError);
	});

	it('an unknown action is refused', () => {
		expect(() =>
			EverConnectAuditService.check({ action: 'instance.delete' as never, actorLabel: 'system' })
		).toThrow(AuditEntryRefusedError);
	});

	it('has no method that changes a row; the only removal is the purge of a deleted organization', () => {
		const methods = Object.getOwnPropertyNames(EverConnectAuditService.prototype);
		expect(methods.filter((name) => /update|delete|remove|purge|clear|edit/i.test(name))).toEqual(['purge']);
	});
});
