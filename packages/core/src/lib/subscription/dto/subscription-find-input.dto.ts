import { PartialType } from '@nestjs/swagger';
import { IEntitySubscriptionFindInput } from '@gauzy/contracts';
import { Subscription } from '../subscription.entity';

export class SubscriptionFindInputDTO extends PartialType(Subscription) implements IEntitySubscriptionFindInput {}
