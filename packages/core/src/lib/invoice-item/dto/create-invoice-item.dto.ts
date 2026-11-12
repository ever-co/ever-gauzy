import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID } from 'class-validator';
import { ID, IInvoiceItemCreateInput } from '@gauzy/contracts';
import { InvoiceItemDTO } from './invoice-item.dto';

export class CreateInvoiceItemDTO extends InvoiceItemDTO implements IInvoiceItemCreateInput {
	/**
	 * The time logs the line bills. `POST /invoices` and `POST /invoice-item/bulk/:invoiceId` record them with the
	 * line, in its transaction; an invoice edit (`PUT /invoices/:id`) does not.
	 */
	@ApiPropertyOptional({ type: () => String, isArray: true })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	readonly timeLogIds?: ID[];
}
