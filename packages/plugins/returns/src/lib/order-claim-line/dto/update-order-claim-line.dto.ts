import { PartialType } from '@nestjs/mapped-types';
import { OrderClaimLineDTO } from './order-claim-line.dto';

/**
 * An update to a claim line. Only an open claim accepts one.
 */
export class UpdateOrderClaimLineDTO extends PartialType(OrderClaimLineDTO) {}
