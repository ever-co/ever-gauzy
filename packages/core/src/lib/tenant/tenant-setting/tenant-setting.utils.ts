import { AwsS3ProviderConfigDTO } from './dto/aws-s3-provider-config.dto';
import { CloudinaryProviderConfigDTO } from './dto/cloudinary-provider-config.dto';
import { DigitalOceanS3ProviderConfigDTO } from './dto/digitalocean-s3.provider-config.dto';
import { MonitoringProviderConfigDTO } from './dto/monitoring-provider-config.dto';
import { WasabiS3ProviderConfigDTO } from './dto/wasabi-s3-provider-config.dto';

/**
 * The provider-configuration DTOs whose `@IsSecret()` marks decide what `TenantSettingGetHandler`
 * masks on the JSON path. Imported from their own files rather than `./dto` so this module never
 * pulls in `CreateTenantSettingDTO`, which composes them through `IntersectionType`.
 */
const SECRET_MARKED_CONFIGS: object[] = [
	new WasabiS3ProviderConfigDTO(),
	new AwsS3ProviderConfigDTO(),
	new CloudinaryProviderConfigDTO(),
	new DigitalOceanS3ProviderConfigDTO(),
	new MonitoringProviderConfigDTO()
];

/**
 * Setting names whose `value` is NOT a credential and may leave the system in cleartext.
 *
 * `tenant_setting` is a free-form key/value table: buckets, regions and endpoint URLs sit in it
 * next to AWS/Wasabi/DigitalOcean secret access keys, the Cloudinary API secret, the PostHog key,
 * the Sentry DSN and the Jitsu write key. There is no way to tell them apart from the value, so the
 * policy is **default-deny** — the same one `nonSecretSettingKeys` applies to `integration_setting`
 * (GHSA-3rqg-gpm9-gx84). A name nobody has classified (a future plugin's setting, say) is treated
 * as a secret, because the cost of over-masking a bucket name in an export archive is nothing and
 * the cost of guessing wrong the other way is a live credential in a downloadable file.
 */
export const nonSecretTenantSettingNames: string[] = [
	// which provider the other keys belong to
	'fileStorageProvider',
	// AWS S3
	'aws_default_region',
	'aws_bucket',
	'aws_force_path_style',
	// Wasabi S3
	'wasabi_aws_bucket',
	'wasabi_aws_default_region',
	'wasabi_aws_service_url',
	'wasabi_aws_force_path_style',
	// Cloudinary
	'cloudinary_cloud_name',
	'cloudinary_api_secure',
	// DigitalOcean Spaces
	'digitalocean_s3_bucket',
	'digitalocean_service_url',
	'digitalocean_cdn_url',
	'digitalocean_default_region',
	'digitalocean_s3_force_path_style',
	// monitoring toggles and endpoints (the keys/DSNs themselves are @IsSecret)
	'posthogEnabled',
	'posthogHost',
	'posthogFlushInterval',
	'sentryEnabled',
	'jitsuEnabled',
	'jitsuHost',
	// tenant-wide UI preference
	'preferredUi'
];

/**
 * Whether a `tenant_setting` row holds a credential.
 *
 * Two sources agree here so the export path and `TenantSettingGetHandler` cannot drift apart in the
 * dangerous direction: a name carrying `@IsSecret()` on one of the provider DTOs is always a
 * secret, and any name that is not on {@link nonSecretTenantSettingNames} is treated as one too.
 *
 * @param name - The `tenant_setting.name` of the row.
 * @returns `true` when the row's value must never be exported in cleartext.
 */
export function isSecretTenantSettingName(name: unknown): boolean {
	// Cannot reach a verdict -> the fail-closed answer.
	if (typeof name !== 'string' || name.trim() === '') {
		return true;
	}

	return isIsSecretMarkedTenantSettingName(name) || !nonSecretTenantSettingNames.includes(name);
}

/**
 * Whether a setting name carries `@IsSecret()` on one of the provider-configuration DTOs.
 *
 * This is the half of {@link isSecretTenantSettingName} that does not depend on the hand-maintained
 * allowlist: it keeps a DTO-declared secret masked even if somebody wrongly adds its name to
 * {@link nonSecretTenantSettingNames}. `@IsSecret()` stores its flag on the DTO prototype, which
 * `Reflect.getMetadata` reaches from an instance by walking the prototype chain.
 *
 * @param name - The `tenant_setting.name` of the row.
 * @returns `true` when a provider DTO declares the setting secret.
 */
export function isIsSecretMarkedTenantSettingName(name: string): boolean {
	return SECRET_MARKED_CONFIGS.some(
		(config) => Reflect.hasMetadata(name, config) && Reflect.getMetadata(name, config) === true
	);
}
