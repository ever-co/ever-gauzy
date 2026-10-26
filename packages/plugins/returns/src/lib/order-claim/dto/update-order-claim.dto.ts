import { PartialType } from '@nestjs/mapped-types';
import { OrderClaimDTO } from './order-claim.dto';

/**
 * An update to a claim that has not been decided yet. A resolved claim is immutable through the API:
 * changing it after a refund was issued would leave the refund explaining a claim that no longer says
 * what it said.
 */
export class UpdateOrderClaimDTO extends PartialType(OrderClaimDTO) {}
