import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { IsNotEmpty, IsString } from 'class-validator';
import { ITenantApiKey } from '@gauzy/contracts';
import { TenantBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { MikroOrmTenantApiKeyRepository } from './repository/mikro-orm-tanant-api-key.repository';

@MultiORMEntity('tenant_api_key', {})
export class TenantApiKey extends TenantBaseEntity implements ITenantApiKey {
	[EntityRepositoryType]?: MikroOrmTenantApiKeyRepository;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	apiKey: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	apiSecret: string;

	@ApiPropertyOptional({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn({ nullable: true })
	openAiSecretKey?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn({ nullable: true })
	openAiOrganizationId?: string;
}
