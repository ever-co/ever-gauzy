import { ITaskPriorityFindInput } from '@gauzy/contracts';
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { TaskSize } from '../size.entity';
import { TenantOrganizationBaseDTO } from './../../../core/dto';

export class SizeQuerDTO extends IntersectionType(
    PartialType(TenantOrganizationBaseDTO), PickType(TaskSize, ['projectId'])
) implements ITaskPriorityFindInput {}
