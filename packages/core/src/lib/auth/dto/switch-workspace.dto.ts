import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';

/**
 * DTO for switching workspace (tenant)
 */
export class SwitchWorkspaceDTO {
	@ApiProperty({ type: () => String, description: 'The tenant ID to switch to' })
	@IsUUID()
	readonly tenantId: ID;
}
