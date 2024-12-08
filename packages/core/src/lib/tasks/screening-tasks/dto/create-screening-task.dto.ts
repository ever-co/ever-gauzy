import { IntersectionType, OmitType } from '@nestjs/swagger';
import { IScreeningTaskCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { MentionUserIdsDTO } from '../../../mention/dto';
import { ScreeningTask } from '../screening-task.entity';

/**
 * Create Sreening Task data validation request DTO
 */
export class CreateScreeningTaskDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		IntersectionType(OmitType(ScreeningTask, ['status']), MentionUserIdsDTO)
	)
	implements IScreeningTaskCreateInput {}
