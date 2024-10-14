import { ApiPropertyOptional, IntersectionType, PickType } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { ActionTypeEnum, BaseEntityEnum, ActorTypeEnum, ID } from '@gauzy/contracts';
import { PaginationParams } from '../../core/crud';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { ActivityLog } from '../activity-log.entity';

// Validate 'orderBy' and 'order' parameters with fallbacks
export const allowedOrderFields = ['createdAt', 'updatedAt', 'entity', 'action'];
export const allowedOrderDirections = ['ASC', 'DESC', 'asc', 'desc'];

/**
 * Filters for ActivityLogs
 */
export class GetActivityLogsDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
	PickType(PaginationParams<ActivityLog>, ['skip', 'take', 'relations']),
	PickType(ActivityLog, ['isActive', 'isArchived'])
) {
	// Filter by entity (example: Organization, Task, OrganizationContact)
	@ApiPropertyOptional({ enum: BaseEntityEnum })
	@IsOptional()
	@IsEnum(BaseEntityEnum)
	entity: BaseEntityEnum;

	// Filter by entityId (example: projectId, taskId, organizationContactId)
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	entityId: ID;

	// Filter by action (example: CREATED, UPDATED, DELETED)
	@ApiPropertyOptional({ enum: ActionTypeEnum })
	@IsOptional()
	@IsEnum(ActionTypeEnum)
	action: ActionTypeEnum;

	// Filter by actorType (example: SYSTEM, USER)
	@ApiPropertyOptional({ type: () => String, enum: ActorTypeEnum })
	@IsOptional()
	@IsEnum(ActorTypeEnum)
	actorType?: ActorTypeEnum;

	// Filter by orderBy (example: createdAt, updatedAt, entity, action)
	@ApiPropertyOptional({ type: () => String, enum: allowedOrderFields })
	@IsOptional()
	@IsString()
	@IsIn(allowedOrderFields) // Allowed fields
	orderBy?: string = 'createdAt';

	// Filter by order (example: ASC, DESC, asc, desc)
	@ApiPropertyOptional({ type: () => String, enum: allowedOrderDirections })
	@IsOptional()
	@IsString()
	@IsIn(allowedOrderDirections)
	order?: 'ASC' | 'DESC' = 'DESC';
}
