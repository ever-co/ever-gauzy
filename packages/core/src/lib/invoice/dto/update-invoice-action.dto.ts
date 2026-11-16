import { EstimateStatusTypesEnum, InvoiceStatusEnumType, InvoiceStatusTypesEnum } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsISO8601, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateInvoiceActionDTO {
	@ApiProperty({
		type: () => String,
		enum: Object.assign({}, InvoiceStatusTypesEnum, EstimateStatusTypesEnum),
		readOnly: true
	})
	@IsOptional()
	@IsEnum(Object.assign({}, InvoiceStatusTypesEnum, EstimateStatusTypesEnum))
	readonly status: InvoiceStatusEnumType;

	@ApiProperty({ type: () => Boolean, readOnly: true })
	@IsOptional()
	@IsBoolean()
	readonly isEstimate: boolean;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly internalNote: string;

	@ApiProperty({ type: () => Boolean, readOnly: true })
	@IsOptional()
	@IsBoolean()
	readonly isArchived: boolean;

	@ApiProperty({ type: () => Boolean, readOnly: true })
	@IsOptional()
	@IsBoolean()
	readonly paid: boolean;

	@ApiProperty({ type: () => Number, readOnly: true })
	@IsOptional()
	@IsNumber()
	readonly alreadyPaid: number;

	@ApiProperty({ type: () => Number, readOnly: true })
	@IsOptional()
	@IsNumber()
	readonly amountDue: number;

	/**
	 * Recipient the invoice/estimate has been sent to.
	 * The route whitelists the payload, so this must be declared to survive validation.
	 */
	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly sentTo: string;

	/**
	 * The `updatedAt` the invoice was read with. Stated, the action is written only while the invoice still holds it,
	 * in the transaction that compares the two; otherwise nothing is written and the answer is 409 with the invoice as
	 * it is now (ever-co/ever-teams#5382). Left out, the action is written as it always was. Never a column.
	 */
	@ApiPropertyOptional({
		type: () => String,
		format: 'date-time',
		description:
			'The updatedAt the invoice was read with. When stated, the action is saved only if the invoice still holds ' +
			'it; otherwise nothing is saved and the answer is 409 Conflict with the invoice as it is now.'
	})
	@IsOptional()
	@IsISO8601({ strict: true })
	readonly expectedUpdatedAt?: string;
}
