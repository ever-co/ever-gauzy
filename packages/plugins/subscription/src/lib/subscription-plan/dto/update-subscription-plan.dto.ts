import { PartialType } from '@nestjs/mapped-types';
import { SubscriptionPlanDTO } from './subscription-plan.dto';

/**
 * An update to a plan.
 *
 * Everything is optional, and the service refuses one change outright: a plan that already has live
 * subscriptions cannot have its `code` moved, because a code is what a customer, an invoice and an
 * import all quote when they mean one plan.
 */
export class UpdateSubscriptionPlanDTO extends PartialType(SubscriptionPlanDTO) {}
