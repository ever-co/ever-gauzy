import { IntersectionType, OmitType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { Subscription } from '../subscription.entity';
import { ISubscriptionCreateInput } from '@gauzy/contracts';

/**
 * Create subscription data validation request DTO
 */
export class CreateSubscriptionDTO
	extends IntersectionType(TenantOrganizationBaseDTO, OmitType(Subscription, ['userId', 'user']))
	implements ISubscriptionCreateInput {}
