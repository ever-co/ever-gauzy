import { IntersectionType, OmitType } from '@nestjs/swagger';
import { IScreeningTaskCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { MentionEmployeeIdsDTO } from '../../../mention/dto';
import { ScreeningTask } from '../screening-task.entity';

/**
 * Create Screening Task data validation request DTO
 */
export class CreateScreeningTaskDTO
	extends IntersectionType(TenantOrganizationBaseDTO, MentionEmployeeIdsDTO, OmitType(ScreeningTask, ['status']))
	implements IScreeningTaskCreateInput {}
