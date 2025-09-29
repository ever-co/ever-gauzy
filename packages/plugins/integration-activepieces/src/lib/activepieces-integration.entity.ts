import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Index, Unique, JoinColumn, RelationId } from 'typeorm';
import { Exclude } from 'class-transformer';
import { IsString, IsOptional, IsBoolean, IsUUID } from 'class-validator';
import { IActivepiecesConfig } from '@gauzy/common';
import { ID, IIntegrationTenant } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, ColumnIndex, IntegrationTenant } from '@gauzy/core';
import { IsSecret } from '@gauzy/core';
import { MikroOrmActivepiecesIntegrationRepository } from './repository/mikro-orm-activepieces-integration.repository';

@MultiORMEntity('activepieces_integration', {
	mikroOrmRepository: () => MikroOrmActivepiecesIntegrationRepository
})
@Index('uq_activepieces_tenant_org_not_null', ['tenantId', 'organizationId'], {
	unique: true,
	where: '"organizationId" IS NOT NULL'
})
@Index('uq_activepieces_tenant_org_null', ['tenantId'], {
	unique: true,
	where: '"organizationId" IS NULL'
})
@Index(['tenantId'])
@Index(['organizationId'])
export class ActivepiecesIntegration extends TenantOrganizationBaseEntity implements IActivepiecesConfig {
	@ApiProperty({ type: () => String })
	@IsString()
	@IsSecret()
	@Exclude() // Exclude from serialization for security
	@MultiORMColumn()
	clientId!: string;

	@ApiProperty({ type: () => String, writeOnly: true, format: 'password' })
	@IsString()
	@IsSecret()
	@Exclude() // Exclude from serialization for security
	@MultiORMColumn({ type: 'text', select: false })
	clientSecret!: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	callbackUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	postInstallUrl?: string;

	@ApiProperty({ type: () => Boolean, default: true })
	@IsBoolean()
	@MultiORMColumn({ default: true })
	override isActive?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	description?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/** What integration tenant sync to */
	@MultiORMManyToOne(() => IntegrationTenant, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	integration?: IIntegrationTenant;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: ActivepiecesIntegration) => it.integration)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	integrationId?: ID;
}
