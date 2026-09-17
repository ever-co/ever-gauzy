import { PartialType } from '@nestjs/mapped-types';
import { SubscriptionDTO } from './subscription.dto';

/**
 * An update to a subscription.
 *
 * The fields a caller may legitimately move are the payer (`paymentAccountHolderId`,
 * `paymentMethodTokenId`), the quantity and the metadata; the plan moves through the plan-change
 * action because a plan change has a price consequence, and the lifecycle moves through pause,
 * resume, cancel and expire.
 */
export class UpdateSubscriptionDTO extends PartialType(SubscriptionDTO) {}
