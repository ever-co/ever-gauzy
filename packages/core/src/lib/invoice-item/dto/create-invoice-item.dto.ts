import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID } from 'class-validator';
import { ID, IInvoiceItemCreateInput } from '@gauzy/contracts';
import { InvoiceItemDTO } from './invoice-item.dto';

export class CreateInvoiceItemDTO extends InvoiceItemDTO implements IInvoiceItemCreateInput {
	/**
	 * The time logs the line bills. `POST /invoices` and `POST /invoice-item/bulk/:invoiceId` record them with the
	 * line, in its transaction; an invoice edit (`PUT /invoices/:id`) does not. On the bulk save, a line that states
	 * none and repeats one of the invoice's lines unchanged keeps the time that line billed; a line that states a
	 * list, even an empty one, bills exactly that list.
	 */
	@ApiPropertyOptional({ type: () => String, isArray: true })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	readonly timeLogIds?: ID[];
}
