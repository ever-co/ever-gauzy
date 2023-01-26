import { ITaskPriorityFindInput } from '@gauzy/contracts';
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { TaskPriority } from '../priority.entity';
import { TenantOrganizationBaseDTO } from './../../../core/dto';

export class TaskPriorityQuerDTO extends IntersectionType(
    PartialType(TenantOrganizationBaseDTO), PickType(TaskPriority, ['projectId'])
) implements ITaskPriorityFindInput {}
