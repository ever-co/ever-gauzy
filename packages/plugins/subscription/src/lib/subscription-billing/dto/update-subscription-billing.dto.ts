import { PartialType } from '@nestjs/mapped-types';
import { SubscriptionBillingDTO } from './subscription-billing.dto';

/**
 * An update to a billing cycle.
 *
 * Narrow on purpose: a caller may correct the amount and the metadata of a cycle that has not been
 * charged, and nothing else. The status moves through `pay` and `waive`, which are the two acts that
 * have a meaning outside this table — one settles money and the other deliberately does not.
 */
export class UpdateSubscriptionBillingDTO extends PartialType(SubscriptionBillingDTO) {}
