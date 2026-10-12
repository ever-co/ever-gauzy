import 'reflect-metadata';
/**
 * 🛑 This import must stay before any import that pulls a core handler — the entity graph has to
 * finish initializing first. See the note in `invite-accept.security.spec.ts`.
 */
import '../core/entities/internal';
import { THROTTLER_LIMIT, THROTTLER_TTL } from '@nestjs/throttler/dist/throttler.constants';
import { InviteController } from './invite.controller';

/**
 * GHSA-86mw-2crg-vmhc (residual) — the public invite routes take an email plus a token or a code,
 * i.e. a guessable credential, and had no per-route limit: they fell under the global
 * `THROTTLE_LIMIT`, which the shipped env files set to 60000 per minute. They are now throttled the
 * way the public auth routes are.
 *
 * `@Throttle` writes its metadata onto the route handler, which is what `ThrottlerGuard` reads.
 */
describe('public invite routes are rate limited (GHSA-86mw-2crg-vmhc)', () => {
	const limitOf = (handler: unknown) => Reflect.getMetadata(`${THROTTLER_LIMIT}default`, handler as object);
	const ttlOf = (handler: unknown) => Reflect.getMetadata(`${THROTTLER_TTL}default`, handler as object);

	it.each([
		['validateInviteByToken', 10],
		['validateInviteByCode', 10],
		['acceptInvitation', 5],
		['rejectInvitation', 5],
		['acceptOrganizationContactInvite', 5]
	])('limits %s to %i requests a minute', (method, limit) => {
		const handler = (InviteController.prototype as any)[method];

		expect(typeof handler).toBe('function');
		expect(limitOf(handler)).toBe(limit);
		expect(ttlOf(handler)).toBe(60000);
	});

	it('CONTROL: a route without @Throttle carries no limit at all', () => {
		// `resendInvite` is authenticated and permission-guarded, so it keeps the global default —
		// and proves the assertions above read real per-route metadata rather than something every
		// handler has.
		const handler = (InviteController.prototype as any)['resendInvite'];

		expect(typeof handler).toBe('function');
		expect(limitOf(handler)).toBeUndefined();
	});
});
