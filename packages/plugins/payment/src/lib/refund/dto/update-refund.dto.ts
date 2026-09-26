import { PartialType } from '@nestjs/mapped-types';
import { CreateRefundDTO } from './create-refund.dto';

/**
 * Update Refund request: every field of the create shape, all of them optional.
 */
export class UpdateRefundDTO extends PartialType(CreateRefundDTO) {}
