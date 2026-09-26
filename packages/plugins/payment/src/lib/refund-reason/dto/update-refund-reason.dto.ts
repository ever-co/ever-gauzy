import { PartialType } from '@nestjs/mapped-types';
import { CreateRefundReasonDTO } from './create-refund-reason.dto';

/**
 * Update RefundReason request: every field of the create shape, all of them optional.
 */
export class UpdateRefundReasonDTO extends PartialType(CreateRefundReasonDTO) {}
