import { ITaskPriorityCreateInput } from '@gauzy/contracts';
import { IntersectionType, PartialType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from './../../../core/dto';
import { TaskPriority } from '../priority.entity';

export class CreateTaskPriorityDTO extends IntersectionType(
    PartialType(TenantOrganizationBaseDTO),
    TaskPriority
) implements ITaskPriorityCreateInput { }
