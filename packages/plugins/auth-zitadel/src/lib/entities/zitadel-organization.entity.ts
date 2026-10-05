import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';

/**
 * The link between one Gauzy organization and one organization on the Ever Platform.
 *
 * Read by the sign-in flow to honour an organization's sign-in rules (a filtered organization, or
 * one that requires its company sign-in). Rows are written only by the organization-linking flow of
 * a connected instance, never from token claims.
 */
@ColumnIndex('IDX_zitadel_organization_organization', ['organizationId'], { unique: true })
@ColumnIndex('IDX_zitadel_organization_ever_org_tenant', ['everOrgId', 'tenantId'], { unique: true })
@ColumnIndex('IDX_zitadel_organization_provision_key', ['provisionKey'], { unique: true })
@MultiORMEntity('zitadel_organization')
export class ZitadelOrganization extends TenantOrganizationBaseEntity {
	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn()
	everOrgId: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn()
	everTenantId: string;

	/** Display only. */
	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn()
	handle: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	identityTier?: string;

	/** When true, an Ever ID sign-in into this organization's tenant must come from its company sign-in. */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ default: false })
	ssoEnforced: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	tenantLinkId?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	linkedAt?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	linkedByUserId?: ID;

	/** Idempotency key of the provisioning call that created the link, when it was provisioned. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	provisionKey?: string;
}
