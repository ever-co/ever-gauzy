import {
	BaseEntityEnum,
	EntitySubscriptionTypeEnum,
	IEmployee,
	IEntitySubscriptionCreateInput
} from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core';

/**
 * Create entity subscription data validation request DTO.
 */
export class CreateEntitySubscriptionDTO extends TenantOrganizationBaseDTO implements IEntitySubscriptionCreateInput {
	type: EntitySubscriptionTypeEnum;
	entityId: string;
	entity: BaseEntityEnum;
	isActive?: boolean;
	isArchived?: boolean;
	archivedAt?: Date;
	deletedAt?: Date;
	employeeId?: string;
	employee?: IEmployee;
}
