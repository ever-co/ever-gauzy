import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { RefundLineDTO } from './refund-line.dto';

/**
 * Create Refund Line request.
 *
 * The writable surface is the aggregate's own DTO; the refund the line belongs to is stated here
 * rather than inherited as optional, because a line created on its own route has to say which refund
 * it accounts for. The tenant, the organization and the audit columns come from the request context,
 * never from the body.
 */
export class CreateRefundLineDTO extends RefundLineDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly refundId: string;
}
