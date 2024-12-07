import { ITaskSizeUpdateInput } from '@gauzy/contracts';
import { IntersectionType, PartialType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from './../../../core/dto';
import { TaskSize } from '../size.entity';

export class UpdateTaskSizeDTO extends IntersectionType(
    PartialType(TenantOrganizationBaseDTO),
    PartialType(TaskSize)
) implements ITaskSizeUpdateInput { }
