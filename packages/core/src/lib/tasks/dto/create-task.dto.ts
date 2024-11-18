import { ITaskCreateInput } from "@gauzy/contracts";
import { IntersectionType, OmitType } from "@nestjs/swagger";
import { TenantOrganizationBaseDTO } from "./../../core/dto";
import { Task } from "./../task.entity";

/**
 * Create task validation request DTO
 */
export class CreateTaskDTO extends IntersectionType(
    TenantOrganizationBaseDTO,
    OmitType(
        Task,
        ['organizationId', 'organization']
    )
) implements ITaskCreateInput { }
