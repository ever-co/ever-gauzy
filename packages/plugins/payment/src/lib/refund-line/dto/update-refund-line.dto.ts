import { PartialType } from '@nestjs/mapped-types';
import { CreateRefundLineDTO } from './create-refund-line.dto';

/**
 * Update Refund Line request: every field of the create shape, all of them optional.
 *
 * What a line explains — its refund and its order line — is refused rather than rewritten when it
 * differs from the stored row: a different order line is a different line, and a settled refund's
 * breakdown is a record.
 */
export class UpdateRefundLineDTO extends PartialType(CreateRefundLineDTO) {}
