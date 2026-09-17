import { PartialType } from '@nestjs/mapped-types';
import { CreateOrderReturnReasonDTO } from './order-return-reason.dto';

/**
 * An update to a reason. `code` is immutable in practice: the returns already filed against the
 * reason carry it in reports, so changing it would rewrite history. The service refuses that.
 */
export class UpdateOrderReturnReasonDTO extends PartialType(CreateOrderReturnReasonDTO) {}
