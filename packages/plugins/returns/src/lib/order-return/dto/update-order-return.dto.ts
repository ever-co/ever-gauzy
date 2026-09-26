import { PartialType } from '@nestjs/mapped-types';
import { OrderReturnDTO } from './order-return.dto';

/**
 * An update to a return that has not been received yet.
 *
 * Everything is optional and the service refuses the update outright once goods have started
 * arriving: a return whose quantities are already half-settled cannot have its line set rewritten
 * underneath the movements that were written for it.
 */
export class UpdateOrderReturnDTO extends PartialType(OrderReturnDTO) {}
