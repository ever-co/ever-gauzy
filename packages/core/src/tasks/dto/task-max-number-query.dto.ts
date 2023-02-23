import { IGetTaskOptions } from '@gauzy/contracts';
import { IntersectionType, PickType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { Task } from "./../task.entity";

/**
 * GET task max number DTO validation
 */
export class TaskMaxNumberQueryDTO extends IntersectionType(
    TenantOrganizationBaseDTO,
    PickType(
        Task,
        ['projectId']
    )
) implements IGetTaskOptions { }
