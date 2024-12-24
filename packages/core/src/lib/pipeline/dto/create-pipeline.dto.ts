import { IPipelineCreateInput } from '@gauzy/contracts';
import { IntersectionType, PickType } from '@nestjs/mapped-types';
import { Pipeline } from '../../core/entities/internal';
import { TenantOrganizationBaseDTO } from '../../core/dto';

/**
 * Pipeline DTO
 */
export class PipelineDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
	PickType(Pipeline, ['name', 'description', 'stages', 'isActive', 'isArchived'])
) {}

/**
 * Create pipeline DTO
 */
export class CreatePipelineDTO extends PipelineDTO implements IPipelineCreateInput {}
