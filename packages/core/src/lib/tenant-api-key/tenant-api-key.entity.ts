import { ApiProperty } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { Exclude } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { ITenantApiKey } from '@gauzy/contracts';
import { IsSecret } from '../core/decorators/is-secret';
import { TenantBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { MikroOrmTenantApiKeyRepository } from './repository/mikro-orm-tenant-api-key.repository';

@MultiORMEntity('tenant_api_key', { mikroOrmRepository: () => MikroOrmTenantApiKeyRepository })
export class TenantApiKey extends TenantBaseEntity implements ITenantApiKey {
	[EntityRepositoryType]?: MikroOrmTenantApiKeyRepository;

	/**
	 * API Key for authenticating requests.
	 * This key is unique and acts as an identifier for API consumers.
	 */
	@ApiProperty({ type: () => String, description: 'The API Key for authentication.' })
	@IsNotEmpty()
	@IsString()
	@IsSecret()
	@Exclude() // Exclude from serialization
	@MultiORMColumn()
	apiKey: string;

	/**
	 * Secret Key corresponding to the API Key.
	 * Used for securely authenticating API requests.
	 */
	@ApiProperty({ type: () => String, description: 'The API Secret for secure authentication.' })
	@IsNotEmpty()
	@IsString()
	@IsSecret()
	@Exclude() // Exclude from serialization
	@MultiORMColumn()
	apiSecret: string;
}
