import 'reflect-metadata';
import {
	isIsSecretMarkedTenantSettingName,
	isSecretTenantSettingName,
	nonSecretTenantSettingNames
} from './tenant-setting.utils';

/**
 * `tenant_setting.value` is redacted on export by name (GHSA-j5h5-r956-rxc3). Two sources decide:
 * the `@IsSecret()` marks on the provider DTOs, and a default-deny allowlist of non-secret names.
 * Each is pinned here on its own, so a refactor that silently disables one is caught even while the
 * other still happens to produce the right overall answer.
 */
describe('tenant-setting utils', () => {
	const DTO_SECRETS = [
		'aws_access_key_id',
		'aws_secret_access_key',
		'wasabi_aws_access_key_id',
		'wasabi_aws_secret_access_key',
		'digitalocean_access_key_id',
		'digitalocean_secret_access_key',
		'cloudinary_api_key',
		'cloudinary_api_secret',
		'posthogKey',
		'sentryDsn',
		'jitsuWriteKey'
	];

	describe('isIsSecretMarkedTenantSettingName', () => {
		it.each(DTO_SECRETS.map((name) => [name]))('reads the @IsSecret() mark for %s from the DTO', (name) => {
			expect(isIsSecretMarkedTenantSettingName(name)).toBe(true);
		});

		it.each([['aws_bucket'], ['aws_default_region'], ['fileStorageProvider'], ['docs.inboundToken']])(
			'does not claim %s is DTO-marked',
			(name) => {
				expect(isIsSecretMarkedTenantSettingName(name)).toBe(false);
			}
		);
	});

	describe('isSecretTenantSettingName', () => {
		it('lets no DTO-declared secret onto the non-secret allowlist', () => {
			expect(DTO_SECRETS.filter((name) => nonSecretTenantSettingNames.includes(name))).toEqual([]);
		});

		it('keeps a DTO-declared secret secret even if its name is wrongly allowlisted', () => {
			nonSecretTenantSettingNames.push('aws_secret_access_key');
			try {
				expect(isSecretTenantSettingName('aws_secret_access_key')).toBe(true);
			} finally {
				nonSecretTenantSettingNames.pop();
			}
		});

		it('treats an unclassified name as a secret and an allowlisted one as plain', () => {
			expect(isSecretTenantSettingName('some.future.setting')).toBe(true);
			expect(isSecretTenantSettingName('aws_bucket')).toBe(false);
		});

		it.each([[undefined], [null], [''], ['   '], [42]])('fails closed for a name it cannot read (%p)', (name) => {
			expect(isSecretTenantSettingName(name)).toBe(true);
		});
	});
});
