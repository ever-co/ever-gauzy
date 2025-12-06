import { ApiPropertyOptional, IntersectionType, PickType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { BaseEntityEnum, ID } from '@gauzy/contracts';
import { BaseQueryDTO } from '../../core/crud';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { EmployeeRecentVisit } from '../employee-recent-visit.entity';

/** Filters for EmployeeRecentVisits */
export class GetEmployeeRecentVisitsDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
	PickType(BaseQueryDTO<EmployeeRecentVisit>, ['skip', 'take', 'relations']),
	PickType(EmployeeRecentVisit, ['isActive', 'isArchived', 'employeeId'])
) {
	// Filter by entity (example: Organization, Task, OrganizationProject, OrganizationTeam)
	@ApiPropertyOptional({ enum: BaseEntityEnum })
	@IsOptional()
	@IsEnum(BaseEntityEnum)
	entity?: BaseEntityEnum;

	// Filter by entityId (example: projectId, taskId, OrganizationProjectId)
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	entityId?: ID;
}
