import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsBoolean, IsOptional } from 'class-validator';
import { ID, IDeleteTimeSlot } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto';

export class DeleteTimeSlotDTO extends TenantOrganizationBaseDTO implements IDeleteTimeSlot {
	/**
	 * An array of IDs representing the time slots to be deleted.
	 * This array must not be empty and ensures that at least one time slot is selected for deletion.
	 */
	@ApiProperty({ type: () => Array })
	@ArrayNotEmpty()
	readonly ids: ID[] = [];

	/**
	 * A flag to determine whether to force delete the time logs.
	 * If `true`, a hard delete will be performed; otherwise, a soft delete is used.
	 * This field is optional and defaults to `false`.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly forceDelete: boolean = false;
}
