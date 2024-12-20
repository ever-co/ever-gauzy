import { ITaskCreateInput } from '@gauzy/contracts';
import { IntersectionType, OmitType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { MentionUserIdsDTO } from '../../mention/dto';
import { Task } from './../task.entity';

/**
 * Create task validation request DTO
 */
export class CreateTaskDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		IntersectionType(OmitType(Task, ['organizationId', 'organization']), MentionUserIdsDTO)
	)
	implements ITaskCreateInput {}
