import { IntersectionType, PickType } from '@nestjs/swagger';
import { IEntitySubscriptionCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { EntitySubscription } from '../entity-subscription.entity';

/**
 * Create entity subscription data validation request DTO.
 */
export class CreateEntitySubscriptionDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		PickType(EntitySubscription, ['type', 'actorType', 'entity', 'entityId'] as const)
	)
	implements IEntitySubscriptionCreateInput {}
