import { ITaskSizeFindInput } from '@gauzy/contracts';
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { TaskSize } from '../size.entity';
import { TenantOrganizationBaseDTO } from './../../../core/dto';

export class TaskSizeQuerDTO extends IntersectionType(
    PartialType(TenantOrganizationBaseDTO), PickType(TaskSize, ['projectId'])
) implements ITaskSizeFindInput {}
