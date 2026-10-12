import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';

/**
 * The query of `GET /email-reset`: whose address-change requests to read. Omit it for the caller's own;
 * another user's requires `ORG_USERS_EDIT`, which the service checks.
 */
export class EmailResetQueryDTO {
	@ApiPropertyOptional({ type: () => String, format: 'uuid' })
	@IsOptional()
	@IsUUID()
	readonly userId?: ID;
}
