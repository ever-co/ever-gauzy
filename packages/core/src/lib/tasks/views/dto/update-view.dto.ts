import { ApiPropertyOptional, IntersectionType, PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { TaskView } from '../view.entity';
import { ITaskViewUpdateInput } from '@gauzy/contracts';

export class UpdateViewDTO
	extends IntersectionType(PartialType(TenantOrganizationBaseDTO), PartialType(TaskView))
	implements ITaskViewUpdateInput
{
	/** The version the client read; the update is refused (409) when the view moved on since. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(1)
	readonly expectedVersion?: number;
}
