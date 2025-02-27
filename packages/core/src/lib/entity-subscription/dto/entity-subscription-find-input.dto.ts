import { PartialType } from '@nestjs/swagger';
import { IEntitySubscriptionFindInput } from '@gauzy/contracts';
import { EntitySubscription } from '../entity-subscription.entity';

export class EntitySubscriptionFindInputDTO
	extends PartialType(EntitySubscription)
	implements IEntitySubscriptionFindInput {}
