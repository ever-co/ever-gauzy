import { ITaskSizeCreateInput } from '@gauzy/contracts';
import { IntersectionType, PartialType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { TaskSize } from '../size.entity';

export class CreateTaskSizeDTO extends IntersectionType(
    PartialType(TenantOrganizationBaseDTO),
    TaskSize
) implements ITaskSizeCreateInput { }
