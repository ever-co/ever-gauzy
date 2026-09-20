import { IntegrationEnum } from '@gauzy/contracts';
import { isNotEmpty, isObject } from '@gauzy/utils';
import { maskSecret } from '../core/decorators/is-secret';

// Assuming you have fetched sensitive keys specific entity
export const sensitiveSecretKeys = ['apiKey', 'apiSecret', 'openAiSecretKey', 'openAiOrganizationId'];

/**
 * Setting names whose `settingsValue` is NOT a secret and may be returned to API clients in
 * cleartext. The masking policy is default-deny: every `settingsValue` is masked EXCEPT for the
 * names in this allowlist. This closes the gap where OAuth access/refresh tokens and client secrets
 * (access_token, refresh_token, client_secret, accessToken, consumerSecret, ...) were serialized
 * verbatim because they were not in the old hard-coded sensitive list (GHSA-3rqg-gpm9-gx84).
 */
export const nonSecretSettingKeys = [
	'isEnabled',
	// the same on/off flag under the spellings individual integrations persist it as
	'is_enabled',
	'IS_ENABLED',
	'make_webhook_enabled',
	'sync',
	'autoSync',
	'syncTag',
	'sync_tag',
	'zone',
	'region',
	'setup_action',
	'installation_id',
	'organizationId',
	'tenantId'
];

/**
 * The integration settings a client may rewrite through the generic `PUT /integration-setting/:id`,
 * keyed by the owning integration tenant's `name` (its provider).
 *
 * Allowlist on purpose: every other setting row is written by the integration itself — OAuth
 * tokens, `installation_id`, `setup_action`, `sync_tag`, account / workspace / instance ids — and
 * the server TRUSTS those values. Rewriting GitHub's `installation_id` through the generic route,
 * for example, pointed a tenant's integration at another tenant's GitHub App installation and
 * skipped every check the install flow makes (GHSA-4rwq-65wh-45h4).
 *
 * The only first-party caller is the Gauzy AI settings card (integration-ai-ui), which edits
 * exactly these four keys. A new user-editable setting has to be added here explicitly.
 */
export const userEditableIntegrationSettings: Readonly<Record<string, readonly string[]>> = Object.freeze({
	[IntegrationEnum.GAUZY_AI]: Object.freeze(['apiKey', 'apiSecret', 'openAiSecretKey', 'openAiOrganizationId'])
});

/**
 * Whether a setting may be rewritten by a client through the generic integration-setting route.
 *
 * @param provider - The owning integration tenant's `name` (an {@link IntegrationEnum} value).
 * @param settingsName - The setting's name.
 * @returns `true` only for settings on the {@link userEditableIntegrationSettings} allowlist.
 */
export function isUserEditableIntegrationSetting(provider: string | null | undefined, settingsName: string): boolean {
	if (!provider || !settingsName || !Object.prototype.hasOwnProperty.call(userEditableIntegrationSettings, provider)) {
		return false;
	}
	return userEditableIntegrationSettings[provider].includes(settingsName);
}

/**
 * Wrap specified keys in an object with a specific character.
 *
 * @param keysToWrap - An array of keys to be wrapped.
 * @param secrets - The object containing the sensitive data.
 * @param _percentage - Ignored. Masking is total; kept only to preserve the positional signature
 *                      for existing callers (see {@link maskSecret}).
 * @param character - The character used for replacement.
 * @returns The object with specified keys wrapped.
 */
export function keysToWrapSecrets(
	keysToWrap: string[],
	secrets: Record<string, any>,
	_percentage = 35,
	character = '*'
) {
	// Checks if a value is an object
	if (isObject(secrets) && Array.isArray(keysToWrap)) {
		// Checks if a value is not empty
		for (const key of keysToWrap) {
			if (isNotEmpty(secrets[key])) {
				secrets[key] = maskSecret(secrets[key], character);
			}
		}
	}
	return secrets;
}
