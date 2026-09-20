import { IGithubAppInstallInput } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 *
 */
export enum GithubSetupActionEnum {
	INSTALL = 'install',
	UPDATE = 'update'
}

/**
 *
 */
export class GithubOAuthDTO extends TenantOrganizationBaseDTO implements IGithubAppInstallInput {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly code: string;
}

/**
 * Payload for minting a single-use, tenant-bound state nonce that starts a GitHub App
 * installation flow (see GithubOAuthStateService / GHSA-4rwq-65wh-45h4).
 */
export class GithubInstallStateDTO extends TenantOrganizationBaseDTO {}

/**
 * The only accepted spelling of a GitHub App installation id: a positive decimal integer with no
 * sign, leading zeros or whitespace (GitHub ids are 64-bit, so at most 20 digits).
 *
 * The cross-tenant uniqueness check compares `settingsValue` as an exact string, so '0123', '123 '
 * or '+123' would otherwise bind installation 123 a second time under a different spelling
 * (GHSA-4rwq-65wh-45h4). With a single canonical form the stored value equals `String(id)`,
 * which is also what the webhook routing compares against.
 */
export const GITHUB_INSTALLATION_ID_PATTERN = /^[1-9][0-9]{0,19}$/;

/**
 *
 */
export class GithubAppInstallDTO implements IGithubAppInstallInput {
	@ApiPropertyOptional({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Matches(GITHUB_INSTALLATION_ID_PATTERN, { message: 'installation_id must be a valid GitHub App installation id' })
	readonly installation_id: string;

	@ApiPropertyOptional({ type: () => String })
	@IsNotEmpty()
	@IsEnum(GithubSetupActionEnum)
	readonly setup_action: GithubSetupActionEnum;

	/**
	 * Single-use state nonce minted by `POST /integration/github/install/state` when the flow was
	 * initiated. Required: it binds the installation to the initiating tenant/organization and
	 * prevents cross-tenant installation hijacking (GHSA-4rwq-65wh-45h4). Format: 64-char lowercase
	 * hex (32 random bytes).
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Matches(/^[a-f0-9]{64}$/, { message: 'state must be a valid GitHub installation nonce' })
	readonly state: string;
}
