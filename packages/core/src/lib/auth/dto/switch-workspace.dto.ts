import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { Expose } from 'class-transformer';
import { ID } from '@gauzy/contracts';

/**
 * DTO for switching workspace (tenant)
 */
export class SwitchWorkspaceDTO {
	@ApiProperty({
		type: () => String,
		description: 'The tenant ID to switch to',
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@IsUUID()
	@Expose()
	readonly tenantId: ID;
}
