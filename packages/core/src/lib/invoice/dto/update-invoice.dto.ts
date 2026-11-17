import { IInvoiceUpdateInput, InvoiceTypeEnum } from '@gauzy/contracts';
import { IntersectionType } from '@nestjs/mapped-types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional } from 'class-validator';
import { RelationalTagDTO } from './../../tags/dto';
import { DiscountInvoiceDTO } from './discount-invoice.dto';
import { InvoiceDTO } from './invoice.dto';
import { TaxInvoiceDTO } from './tax-invoice.dto';

/**
 * PUT /invoices/:id runs with `whitelist: true` (GHSA-jh6m-9fxr-rx3c), so every field the invoice
 * edit screen sends has to be declared here or on the DTOs it extends.
 */
export class UpdateInvoiceDTO
	extends IntersectionType(InvoiceDTO, TaxInvoiceDTO, RelationalTagDTO, DiscountInvoiceDTO)
	implements IInvoiceUpdateInput
{
	@ApiPropertyOptional({ type: () => String, enum: InvoiceTypeEnum, readOnly: true })
	@IsOptional()
	@IsEnum(InvoiceTypeEnum)
	readonly invoiceType?: InvoiceTypeEnum;

	/**
	 * The `updatedAt` the invoice was read with. Stated, the edit is saved only while the invoice still holds it, in the
	 * transaction that compares the two; otherwise nothing is saved and the answer is 409 with the invoice as it is now.
	 * Left out, the edit is saved as it always was. Never a column: the update does not write it.
	 */
	@ApiPropertyOptional({
		type: () => String,
		format: 'date-time',
		description:
			'The updatedAt the invoice was read with. When stated, the change is saved only if the invoice still holds ' +
			'it; otherwise nothing is saved and the answer is 409 Conflict with the invoice as it is now.'
	})
	@IsOptional()
	@IsISO8601({ strict: true })
	readonly expectedUpdatedAt?: string;
}
