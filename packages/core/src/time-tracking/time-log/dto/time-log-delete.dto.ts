import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsBoolean, IsOptional } from 'class-validator';
import { ID, IDeleteTimeLog } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto';

/**
 * Data Transfer Object for deleting time logs.
 *
 * This DTO is used to define the structure of the data required for deleting
 * time logs. It extends the `TenantOrganizationBaseDTO`, ensuring tenant and
 * organization context is maintained. The DTO includes an array of log IDs
 * that must not be empty and an optional `forceDelete` flag to determine
 * whether a hard or soft delete should be performed.
 */
export class TimeLogDeleteDTO extends TenantOrganizationBaseDTO implements IDeleteTimeLog {
	/**
	 * An array of time log IDs that need to be deleted.
	 * This field is required and must contain at least one ID.
	 */
	@ApiProperty({ type: () => Array })
	@ArrayNotEmpty()
	logIds: ID[] = [];

	/**
	 * A flag to determine whether to force delete the time logs.
	 * If `true`, a hard delete will be performed; otherwise, a soft delete is used.
	 * This field is optional and defaults to `false`.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	forceDelete: boolean = false;
}
