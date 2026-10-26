import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

/**
 * Update line-to-invoice link request validation.
 *
 * Only `metadata` is accepted, and the narrowness is the point: a link's quantity, amount, direction
 * and item describe a document that has been issued, so correcting any of them would silently restate
 * what an invoice says. A correction is a credit — another link, in the opposite direction — and the
 * service refuses anything else rather than quietly ignoring it.
 */
export class UpdateOrderLineInvoiceDTO {
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
