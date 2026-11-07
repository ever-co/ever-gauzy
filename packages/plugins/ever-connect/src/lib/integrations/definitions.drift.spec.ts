import { createHash } from 'node:crypto';
import { INTEGRATIONS, SCHEMAS } from '../sdk';
import {
	GAUZY_INTEGRATIONS,
	gauzyIntegration,
	offeredOn,
	requiredFeature,
	sharedDefinition
} from './integration-definitions';

/**
 * The scopes Gauzy shows (and app.ever.co consents to) are the definitions of the SDK's contracts
 * package (`@ever-co/connect-contracts`). Each key Gauzy offers pins the `scope_version` and the
 * SHA-256 of the scope it was reviewed with; when a new package version changes a scope, this fails
 * until the pin is reviewed and updated. (The SDK's own build checks that a changed scope also gets
 * a new `scope_version`.)
 */

/** The SDK's digest of a scope: SHA-256 of its JSON with sorted keys, two-space indented, plus a newline. */
function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeys);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value as Record<string, unknown>)
				.sort()
				.map((key) => [key, sortKeys((value as Record<string, unknown>)[key])])
		);
	}
	return value;
}
export const scopeDigest = (scope: unknown): string =>
	createHash('sha256')
		.update(`${JSON.stringify(sortKeys(scope ?? []), null, 2)}\n`)
		.digest('hex');

describe('integration definitions', () => {
	it('Gauzy offers exactly the SDK keys whose products include gauzy', () => {
		const forGauzy = Object.values(INTEGRATIONS)
			.filter((definition) => definition.products.includes('gauzy'))
			.map((definition) => definition.key)
			.sort();
		expect(GAUZY_INTEGRATIONS.map((definition) => definition.key).sort()).toEqual(forGauzy);
	});

	it('Sign in with Ever ID is pinned at its second scope version (the consent text app.ever.co shows)', () => {
		expect(gauzyIntegration('ever_id_login')?.scopeVersion).toBe(2);
	});

	it.each(GAUZY_INTEGRATIONS.map((definition) => [definition.key, definition] as const))(
		'%s: the pinned scope version and digest are the scope shipped',
		(key, definition) => {
			const shared = sharedDefinition(key);
			expect(definition.scopeVersion).toBe(shared.scope_version);
			expect(scopeDigest(shared.scope)).toBe(definition.scopeSha256);
		}
	);

	it('only instance_url, stats_link and ever_id_login run without a handler; lookup and discoverability need theirs', () => {
		expect(
			GAUZY_INTEGRATIONS.filter((definition) => definition.available).map((definition) => definition.key)
		).toEqual(['instance_url', 'stats_link', 'ever_id_login']);
		expect(gauzyIntegration('counterparty_lookup')?.available).toBe(false);
		expect(gauzyIntegration('counterparty_discoverable')?.available).toBe(false);
	});

	it('the installation-wide keys are instance_url, stats_link, ever_id_login and webhooks', () => {
		expect(
			GAUZY_INTEGRATIONS.filter((definition) => definition.instanceWide)
				.map((definition) => definition.key)
				.sort()
		).toEqual(['ever_id_login', 'instance_url', 'stats_link', 'webhooks']);
	});

	it('stats_link is never offered on Ever Cloud; billing_link only there', () => {
		expect(offeredOn(gauzyIntegration('stats_link')!, true)).toBe(false);
		expect(offeredOn(gauzyIntegration('stats_link')!, false)).toBe(true);
		expect(offeredOn(gauzyIntegration('billing_link')!, false)).toBe(false);
	});

	/** The feature names of the pinned entitlement document (`ever.features`). */
	const entitlementFeatures = (): string[] => {
		const schema = SCHEMAS.entitlement as {
			properties?: { ever?: { properties?: { features?: { properties?: Record<string, unknown> } } } };
		};
		return Object.keys(schema.properties?.ever?.properties?.features?.properties ?? {});
	};

	it.each(GAUZY_INTEGRATIONS.map((definition) => [definition.key] as const))(
		'%s: the feature it needs is one the entitlement document carries (the gate names agree)',
		(key) => {
			const feature = requiredFeature(key);
			if (feature !== null) {
				expect(entitlementFeatures()).toContain(feature);
			}
		}
	);

	it('the counterparty check, discoverability and the marketplace keys are gated by lookup, discoverability and listings', () => {
		expect(requiredFeature('counterparty_lookup')).toBe('lookup');
		expect(requiredFeature('counterparty_discoverable')).toBe('discoverability');
		expect(requiredFeature('provider_access')).toBe('listings');
		expect(requiredFeature('marketplace_installs')).toBe('listings');
	});

	it('a gate name the entitlement document does not carry fails (control)', () => {
		expect(entitlementFeatures().length).toBeGreaterThan(5);
		expect(entitlementFeatures()).not.toContain('discoverable');
	});

	it('a changed scope without a new scope_version fails (control)', () => {
		const shared = sharedDefinition('stats_link');
		const changed = [...shared.scope, { ...shared.scope[0], field_path: 'instance.something_else' }];
		expect(scopeDigest(changed)).not.toBe(gauzyIntegration('stats_link')!.scopeSha256);
	});
});
