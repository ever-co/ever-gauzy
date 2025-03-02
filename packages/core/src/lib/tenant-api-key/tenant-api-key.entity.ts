import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { Exclude } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { ITenantApiKey } from '@gauzy/contracts';
import { IsSecret } from '../core/decorators/is-secret';
import { TenantBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { MikroOrmTenantApiKeyRepository } from './repository/mikro-orm-tenant-api-key.repository';

@MultiORMEntity('tenant_api_key', { mikroOrmRepository: () => MikroOrmTenantApiKeyRepository })
export class TenantApiKey extends TenantBaseEntity implements ITenantApiKey {
	[EntityRepositoryType]?: MikroOrmTenantApiKeyRepository;

	/**
	 * The name or identifier of the client or user consuming the API.
	 * This helps track who is using the API Key/Secret pair.
	 *
	 * - **Type**: `string`
	 * - **Purpose**: To store a user-friendly name for identifying API consumers.
	 * - **Example**: `"MyClientApp"` or `"ServiceA"`
	 */
	@ApiPropertyOptional({
		type: () => String,
		description: 'The name or identifier of the client or user consuming the API.',
		minLength: 1,
		maxLength: 255
	})
	@IsOptional()
	@IsString()
	@Length(1, 255)
	@MultiORMColumn({ nullable: true })
	name: string;

	/**
	 * The API Key for authentication.
	 * This key is unique and acts as an identifier for API consumers.
	 *
	 * - **Type**: `string`
	 * - **Purpose**: To authenticate API requests by identifying the client.
	 * - **Serialization**: Excluded from API responses for security reasons.
	 * - **Example**: `"abc123xyz"`
	 */
	@ApiProperty({
		type: () => String,
		description: 'The API Key for authentication.'
	})
	@IsNotEmpty()
	@IsString()
	@IsSecret()
	@Exclude() // Exclude from serialization
	@MultiORMColumn()
	apiKey: string;

	/**
	 * The API Secret for secure authentication.
	 * This secret key is paired with the `apiKey` to validate API requests securely.
	 *
	 * - **Type**: `string`
	 * - **Purpose**: Acts as a secure credential for authenticating API consumers.
	 * - **Serialization**: Excluded from API responses for security reasons.
	 * - **Example**: `"secretKey123"`
	 */
	@ApiProperty({
		type: () => String,
		description: 'The API Secret for secure authentication.'
	})
	@IsNotEmpty()
	@IsString()
	@IsSecret()
	@Exclude() // Exclude from serialization
	@MultiORMColumn({ type: 'text' })
	apiSecret: string;
}
