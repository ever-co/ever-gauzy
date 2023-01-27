import { ITaskStatusFindInput } from '@gauzy/contracts';
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from './../../../core/dto';
import { TaskStatus } from './../status.entity';

export class StatusQuerDTO extends IntersectionType(
	PartialType(TenantOrganizationBaseDTO),
	PickType(TaskStatus, ['projectId'])
) implements ITaskStatusFindInput {}
