import { ApiProperty, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CreateInvoiceItemDTO } from './../../invoice-item/dto';
import { UpdateInvoiceDTO } from './update-invoice.dto';

/**
 * `PUT /invoices/:id/with-items`: an invoice's fields and all its lines, saved together in one transaction, so a save
 * that fails leaves the invoice as it was rather than with its fields written and its lines not.
 *
 * The fields are those of `PUT /invoices/:id`, `expectedUpdatedAt` included; the lines are those of
 * `POST /invoice-item/bulk/:invoiceId`, and replace every line the invoice holds.
 */
export class UpdateInvoiceWithItemsDTO extends OmitType(UpdateInvoiceDTO, ['invoiceItems'] as const) {
	/** Every line of the invoice once saved. Each is a line of this invoice, whichever `invoiceId` it states. */
	@ApiProperty({ type: () => CreateInvoiceItemDTO, isArray: true })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateInvoiceItemDTO)
	readonly invoiceItems: CreateInvoiceItemDTO[];
}
