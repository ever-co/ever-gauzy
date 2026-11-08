import { gauzyIntegration, GAUZY_INTEGRATIONS } from '../integrations/integration-definitions';
import {
	IntegrationHandler,
	IntegrationHandlerConflictError,
	IntegrationHandlerRegistry
} from '../integrations/integration-handler.registry';
import { INTEGRATIONS_GET, LINK_ID, lookupHarness, LookupHarness } from '../fixtures/lookup-harness';

/**
 * An integration Gauzy offers runs only when this installation has code for it: one of the
 * connection's own (`instance_url`, `stats_link`, `ever_id_login`), or a handler registered for its
 * key. Without one it reads "coming soon" whatever Ever Platform says, and nothing of it moves;
 * registering a handler is all it takes to make it available.
 */
describe('the integration handler registry', () => {
	it('holds one handler per key', () => {
		const registry = new IntegrationHandlerRegistry();
		const handler: IntegrationHandler = { key: 'provider_access' };
		expect(registry.has('provider_access')).toBe(false);
		registry.register(handler);
		registry.register(handler);
		expect(registry.has('provider_access')).toBe(true);
		expect(registry.get('provider_access')).toBe(handler);
		expect(registry.all()).toEqual([handler]);
		expect(() => registry.register({ key: 'provider_access' })).toThrow(IntegrationHandlerConflictError);
		expect(registry.get('marketplace_installs')).toBeNull();
	});

	describe('on a connected installation', () => {
		let h: LookupHarness;

		afterEach(async () => {
			await h.close();
		});

		/** Ever Platform reads `key` as enabled for the link (a consent in app.ever.co). */
		function platformEnables(key: string): void {
			h.platform.on(INTEGRATIONS_GET, {
				status: 200,
				body: {
					instance: {},
					links: {
						[LINK_ID]: {
							[key]: {
								enabled: true,
								state: 'enabled',
								consent_id: '01JD0000000000000000000CNS',
								scope_version: 1
							}
						}
					}
				}
			});
		}

		const view = async (key: string) =>
			(await h.states.list({ ...h.scope, userId: h.scope.userId })).find((row) => row.key === key);

		it('a key without a handler is coming soon, whatever Ever Platform says, and nothing of it runs', async () => {
			h = await lookupHarness({ register: false });
			platformEnables('counterparty_lookup');
			await h.states.sync({ force: true });
			expect((await h.store.integration(LINK_ID, 'counterparty_lookup'))?.state).toBe('coming_soon');
			expect((await view('counterparty_lookup'))?.state).toBe('coming_soon');
			for (const key of ['provider_access', 'marketplace_installs', 'counterparty_discoverable']) {
				expect((await view(key))?.state).toBe('coming_soon');
			}
			// No consent link is asked for an integration this installation cannot run.
			await expect(h.states.consentUrl('counterparty_lookup', h.scope)).rejects.toMatchObject({
				response: { code: 'not_available' }
			});
		});

		it('the counterparty check and discoverability register their handlers: the rows become available', async () => {
			h = await lookupHarness();
			expect(h.handlers.has('counterparty_lookup')).toBe(true);
			expect(h.handlers.has('counterparty_discoverable')).toBe(true);
			expect((await view('counterparty_lookup'))?.state).toBe('available');
			expect((await view('counterparty_discoverable'))?.state).toBe('available');
			platformEnables('counterparty_lookup');
			await h.states.sync({ force: true });
			const row = await view('counterparty_lookup');
			expect(row).toMatchObject({
				state: 'enabled',
				enabled: true,
				requires_feature: 'lookup',
				feature_on: true
			});
			expect(row?.options).toEqual({ auto_check: false });
		});

		it('provider_access becomes available once a handler registers, with no other change; its enable runs the handler', async () => {
			h = await lookupHarness();
			expect((await view('provider_access'))?.state).toBe('coming_soon');
			const enabled: string[] = [];
			h.handlers.register({ key: 'provider_access', onEnable: async (row) => void enabled.push(row.scope) });
			expect((await view('provider_access'))?.state).toBe('available');
			platformEnables('provider_access');
			await h.states.sync({ force: true });
			expect((await view('provider_access'))?.state).toBe('enabled');
			expect(enabled).toEqual([LINK_ID]);
			// marketplace_installs still has none.
			expect((await view('marketplace_installs'))?.state).toBe('coming_soon');
		});

		it('a feature the entitlement does not grant reads feature_on false', async () => {
			h = await lookupHarness();
			h.features['lookup'] = false;
			expect((await view('counterparty_lookup'))?.feature_on).toBe(false);
			expect((await view('provider_access'))?.requires_feature).toBe('listings');
			// An installation-wide integration is not the organization's: no answer.
			expect((await view('ever_id_login'))?.feature_on).toBeNull();
		});
	});

	it('the static table keeps provider_access and marketplace_installs, gated by handlers, at their pinned scope', () => {
		for (const key of [
			'provider_access',
			'marketplace_installs',
			'counterparty_lookup',
			'counterparty_discoverable'
		]) {
			expect(gauzyIntegration(key)).toMatchObject({ available: false, scopeVersion: 1, instanceWide: false });
		}
		expect(GAUZY_INTEGRATIONS.filter((definition) => definition.available).map((d) => d.key)).toEqual([
			'instance_url',
			'stats_link',
			'ever_id_login'
		]);
	});
});
