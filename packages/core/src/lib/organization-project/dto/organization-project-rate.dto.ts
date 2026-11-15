import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, Matches, Max, Min, ValidateIf } from 'class-validator';
import { APPLY_FROM_PATTERN } from '../../shared/validators/apply-from';
import { IOrganizationProjectRateUpdateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { BILLING_RATE_MAX, toNullableBillingRate } from '../../shared/pipes/billing-rate.transform';

/**
 * A project's client rate, or a member's client rate on a project: a non-negative amount per hour, or `null` to clear
 * it. A body without the field is refused rather than read as 0.
 */
export class OrganizationProjectRateDTO
	extends TenantOrganizationBaseDTO
	implements IOrganizationProjectRateUpdateInput
{
	@ApiProperty({
		type: () => Number,
		nullable: true,
		description: "What the client is billed per hour, in the project's currency; null clears it"
	})
	@Transform(toNullableBillingRate)
	@ValidateIf((dto: OrganizationProjectRateDTO) => dto.billRateValue !== null)
	@IsNumber({ allowNaN: false, allowInfinity: false })
	@Min(0)
	@Max(BILLING_RATE_MAX)
	readonly billRateValue: number | null;

	@ApiPropertyOptional({
		type: () => String,
		format: 'date-time',
		description:
			'Apply the new rate to the time logs started on or after this day (time a live invoice bills keeps its ' +
			"price). Without it, all the time already tracked takes it, unless the organization's time logs keep " +
			'their rates (timeLogsKeepTheirRates): then only time recorded from now on does.'
	})
	@IsOptional()
	@IsDateString()
	@Matches(APPLY_FROM_PATTERN, { message: 'applyFrom must be a date or a date-time with its offset' })
	readonly applyFrom?: string;
}
