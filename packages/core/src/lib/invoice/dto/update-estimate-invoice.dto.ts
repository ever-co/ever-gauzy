import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsISO8601, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateEstimateInvoiceDTO {
	@ApiProperty({ type: () => Boolean, readOnly: true })
	@IsNotEmpty()
	@IsBoolean()
	readonly isAccepted: boolean;

	/**
	 * The `updatedAt` the estimate was read with. Stated, the answer is written only while the estimate still holds it,
	 * in the transaction that compares the two; otherwise nothing is written and the answer is 409 with the estimate as
	 * it is now (ever-co/ever-teams#5382). Left out, the answer is written as it always was. Never a column.
	 */
	@ApiPropertyOptional({
		type: () => String,
		format: 'date-time',
		description:
			'The updatedAt the estimate was read with. When stated, the answer is saved only if the estimate still ' +
			'holds it; otherwise nothing is saved and the answer is 409 Conflict with the estimate as it is now.'
	})
	@IsOptional()
	@IsISO8601({ strict: true })
	readonly expectedUpdatedAt?: string;
}
