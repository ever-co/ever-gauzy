import { PickType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from './../../core/dto';

/**
 * The caller's organization when one member is assigned to or taken off a task. It must be one of the caller's
 * organizations and the task's, and it is never written to the task.
 */
export class TaskMemberDTO extends PickType(TenantOrganizationBaseDTO, ['organizationId'] as const) {}
