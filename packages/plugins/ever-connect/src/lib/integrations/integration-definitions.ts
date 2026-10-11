import { isInstanceWideKey } from '../ever-connect.constants';
import { INTEGRATIONS, IntegrationDefinition, IntegrationKey } from '../sdk';

/**
 * The integrations Ever Gauzy offers, as data. What each one moves (its scope rows, purpose,
 * retention and frequency) comes from the Ever Platform SDK's definitions, the same data app.ever.co
 * renders its consent screen from; this file adds what is Gauzy's own:
 *
 * - `scopeVersion` and `scopeSha256` pin the scope this release was reviewed with: when the SDK's
 *   scope changes, `definitions.drift.spec.ts` fails until the pin is updated (and a scope change
 *   without a new `scope_version` fails there too);
 * - `available`: `true` only for the integrations this release can run. The others read "coming
 *   soon" here whatever Ever Platform says, and nothing of theirs moves;
 * - `instanceWide`: the integration acts for the whole installation; only its operator asks for
 *   the consent and accepts it locally;
 * - `appEverCoOnly`: consent only in app.ever.co.
 */
export interface GauzyIntegrationDefinition {
	key: IntegrationKey;
	scopeVersion: number;
	scopeSha256: string;
	available: boolean;
	instanceWide: boolean;
	appEverCoOnly: boolean;
}

const pin = (
	key: IntegrationKey,
	scopeSha256: string,
	available: boolean,
	appEverCoOnly = false
): GauzyIntegrationDefinition => ({
	key,
	scopeVersion: 1,
	scopeSha256,
	available,
	instanceWide: isInstanceWideKey(key),
	appEverCoOnly
});

/** Every integration key Ever Gauzy offers, with its pinned scope. */
export const GAUZY_INTEGRATIONS: ReadonlyArray<GauzyIntegrationDefinition> = Object.freeze([
	// The public address of this installation, sent only after a consent in app.ever.co and the
	// operator's accept.
	pin('instance_url', '4d49f2e6b58f02e7476680daad357fba6a3f0af18e7c1e393e8707d7ca120cf3', true, true),
	// Links this installation's anonymous statistics to the organization that connected it.
	pin('stats_link', '390773fb3fbffb6d5b48d2d6f220a2a0a827fd6ff01cbd66cd3186062eabe437', true),
	pin('ever_id_login', '210842e6907fe9d071074098ac8a9b81143a3031995cc00ecff5a9d882dd30bd', false),
	pin('counterparty_lookup', '67ad3983e9ac1f6cafdeee3aacf8b6ecad95bc72d878cd92f7711031bcfc88ce', false),
	pin('counterparty_discoverable', '170ea9ef4df68381e0b94f81b83154e0a67b7d3b7a59269b09462c22f1171c9f', false, true),
	pin('profile_import', '23cc377dc8172f610704e18908a826c45d03a1096fa43f0c907d842568f6d582', false),
	pin('usage_reporting', 'b4c8eb301eca01068617b749162548324275e8ee6d3bd82e68cf8809eadcde2f', false),
	pin('billing_link', '0107fb9b931fa1d27104091bc1de04f6a2485252e9cdb65b84913560dbc927c8', false),
	pin('webhooks', 'f96fa2e6fd604320f3649e8d9200b270927cc32ff9af6c78b2ca7b66e08c3bc7', false),
	pin('managed_operations', '4c09674f3374371a30cb96298e1fda97277ba2ad13ca05accbe2362938a1db93', false),
	pin('provider_access', '8f7f959b0ba746bd27f97426aad84e7e5bf7571293a40fc115d86af16dbce23a', false),
	pin('marketplace_installs', '467cea708e8881aa2a03feaeb6dedf08a7960c2b583c3f321628f0aaf399b3e6', false)
]);

/** Gauzy's definition of `key`, or `null` when Gauzy does not offer it. */
export function gauzyIntegration(key: string): GauzyIntegrationDefinition | null {
	return GAUZY_INTEGRATIONS.find((definition) => definition.key === key) ?? null;
}

/** The shared definition (what moves, why, how often), from the SDK. */
export function sharedDefinition(key: IntegrationKey): IntegrationDefinition {
	return INTEGRATIONS[key];
}

/** Whether `key` is offered on this installation: `stats_link` is never offered on Ever Cloud. */
export function offeredOn(definition: GauzyIntegrationDefinition, cloud: boolean): boolean {
	const availability = sharedDefinition(definition.key).availability;
	return (cloud ? availability.cloud : availability.self_hosted) !== 'not_applicable';
}
