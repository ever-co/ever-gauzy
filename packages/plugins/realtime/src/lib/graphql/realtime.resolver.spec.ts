import { Test } from '@nestjs/testing';
import {
	FeatureFlagGuard,
	GraphqlPubSub,
	PermissionGuard,
	SubscriptionCatalogue,
	TenantPermissionGuard
} from '@gauzy/core';
import { RealtimeAudience } from '../realtime-audience';
import { RealtimeResolver } from './realtime.resolver';

/**
 * `Subscription.collaborationEvents` offers the names the subscription catalogue holds — the channel's own plus the
 * chat and inbox families those plugins declare when they load. The resolver took the catalogue as an optional
 * `SubscriptionCatalogue | undefined`, a type TypeScript emits as `Object`: Nest could not resolve it, the catalogue
 * was always undefined, and every selection of a chat or inbox event was refused ("The selection matches no
 * collaboration event") and the subscription completed at once. The suites built the resolver with `new` and never
 * saw it.
 */
describe('RealtimeResolver, as Nest builds it', () => {
	it('is handed the subscription catalogue the plugins declare their events in', async () => {
		const moduleRef = await Test.createTestingModule({
			providers: [
				{ provide: GraphqlPubSub, useValue: new GraphqlPubSub() },
				SubscriptionCatalogue,
				{
					provide: RealtimeAudience,
					useValue: { admitted: async (events: unknown[]) => events.map(() => true) }
				},
				RealtimeResolver
			]
		})
			// The guards run per request; what is under test is how the resolver itself is built.
			.overrideGuard(TenantPermissionGuard)
			.useValue({ canActivate: () => true })
			.overrideGuard(PermissionGuard)
			.useValue({ canActivate: () => true })
			.overrideGuard(FeatureFlagGuard)
			.useValue({ canActivate: () => true })
			.compile();

		const resolver = moduleRef.get(RealtimeResolver);
		const catalogue = moduleRef.get(SubscriptionCatalogue);

		expect((resolver as unknown as { catalogue?: SubscriptionCatalogue }).catalogue).toBe(catalogue);
		await moduleRef.close();
	});
});
