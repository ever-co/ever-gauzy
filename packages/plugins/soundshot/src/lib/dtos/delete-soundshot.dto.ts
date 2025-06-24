import { ID, IDeleteEntity as IDeleteSoundshot } from '@gauzy/contracts';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsBoolean, IsUUID } from 'class-validator';

export class DeleteSoundshotDTO implements IDeleteSoundshot {
	/**
	 * If true, the soundshot will be forcefully deleted, bypassing any soft-delete logic.
	 * Optional field, defaults to false if not provided.
	 */
	@ApiPropertyOptional({
		description: 'If true, forcefully deletes the soundshot, bypassing soft-delete logic. Optional.',
		example: false,
		type: Boolean,
	})
	@IsOptional()
	@IsBoolean()
	@Type(() => Boolean)
	readonly forceDelete?: boolean;

	/**
	 * The organization ID associated with the soundshot. Optional, must be a valid UUID if provided.
	 */
	@ApiPropertyOptional({
		description: 'Organization ID associated with the soundshot. Optional, must be a valid UUID if provided.',
		example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
		type: String,
	})
	@IsOptional()
	@IsUUID()
	readonly organizationId?: ID;

	/**
	 * The tenant ID associated with the soundshot. Optional, must be a valid UUID if provided.
	 */
	@ApiPropertyOptional({
		description: 'Tenant ID associated with the soundshot. Optional, must be a valid UUID if provided.',
		example: 'f1e2d3c4-b5a6-7c8d-9e0f-1a2b3c4d5e6f',
		type: String,
	})
	@IsOptional()
	@IsUUID()
	readonly tenantId?: ID;
}
