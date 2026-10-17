import { PartialType } from '@nestjs/mapped-types';
import { SubscriptionItemDTO } from './subscription-item.dto';

/**
 * An update to a recurring line.
 *
 * The subscription and the variant are immutable: one row per `(subscription, variant)` is what
 * makes "how many of this does the customer get" answerable, so a change to either is a removal and
 * an addition rather than an edit.
 */
export class UpdateSubscriptionItemDTO extends PartialType(SubscriptionItemDTO) {}
