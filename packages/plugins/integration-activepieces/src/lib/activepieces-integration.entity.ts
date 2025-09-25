import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Index, Unique } from 'typeorm';
import { Exclude } from 'class-transformer';
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { IActivepiecesConfig } from '@gauzy/common';
import { TenantOrganizationBaseEntity, MultiORMColumn, MultiORMEntity } from '@gauzy/core';
import { IsSecret } from '@gauzy/core';

@MultiORMEntity('activepieces_integration', { database: 'default' })
@Unique(['tenantId', 'organizationId'])
@Index(['tenantId'])
@Index(['organizationId'])
export class ActivepiecesIntegration extends TenantOrganizationBaseEntity implements IActivepiecesConfig {
	@ApiProperty({ type: () => String })
	@IsString()
	@IsSecret()
	@Exclude() // Exclude from serialization for security
	@MultiORMColumn()
	clientId!: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsSecret()
	@Exclude() // Exclude from serialization for security
	@MultiORMColumn({ type: 'text' })
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
}
