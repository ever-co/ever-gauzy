import { IntersectionType, OmitType } from '@nestjs/swagger';
import { IScreeningTaskUpdateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { ScreeningTask } from '../screening-task.entity';

/**
 * Update Screening Task data validation request DTO
 */
export class UpdateScreeningTaskDTO
	extends IntersectionType(TenantOrganizationBaseDTO, OmitType(ScreeningTask, ['task', 'taskId']))
	implements IScreeningTaskUpdateInput {}
