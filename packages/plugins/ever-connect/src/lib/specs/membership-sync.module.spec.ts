import { Type } from '@nestjs/common';
import { EverConnectModule } from '../ever-connect.module';
import { MembershipSyncHandler } from '../membership/membership-sync.handler';

/**
 * The membership sync is part of the module only with `EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED=true` (and Ever ID
 * sign-in): by default its handler is not registered at all, so the feed acknowledges membership changes and
 * nothing reads or writes for them.
 */
describe('Ever Platform membership sync: registration', () => {
	const ON = { EVER_CONNECT_ENABLED: 'true', EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED: 'true', ZITADEL_ENABLED: 'true' };

	const providers = (env: Record<string, string | undefined>) =>
		(EverConnectModule.register(env).providers as Array<Type<unknown> | { provide: unknown }>).map((provider) =>
			typeof provider === 'function' ? provider : provider.provide
		);

	it('is not registered by default, nor without each of its conditions', () => {
		for (const env of [
			{},
			{ EVER_CONNECT_ENABLED: 'true' },
			{ EVER_CONNECT_ENABLED: 'true', ZITADEL_ENABLED: 'true' },
			{ ...ON, EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED: 'false' },
			{ ...ON, EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED: 'TRUE' },
			{ ...ON, ZITADEL_ENABLED: undefined },
			{ ...ON, EVER_CONNECT_ENABLED: undefined }
		]) {
			expect(providers(env)).not.toContain(MembershipSyncHandler);
		}
	});

	it('is registered with the switch on', () => {
		expect(providers(ON)).toContain(MembershipSyncHandler);
	});
});
