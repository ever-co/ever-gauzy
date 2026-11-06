import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CurrenciesEnum, IEmployeeRateChangeRequestInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { BILLING_RATE_MAX, toNullableBillingRate } from '../../shared/pipes/billing-rate.transform';

/** The rate an employee asks an admin for. The employee is the caller, so the body never names one. */
export class EmployeeRateChangeRequestDTO extends TenantOrganizationBaseDTO implements IEmployeeRateChangeRequestInput {
	@ApiProperty({ type: () => Number })
	@Transform(toNullableBillingRate)
	@IsNumber({ allowNaN: false, allowInfinity: false })
	@Min(0)
	@Max(BILLING_RATE_MAX)
	readonly billRateValue: number;

	@ApiPropertyOptional({ enum: CurrenciesEnum })
	@IsOptional()
	@IsEnum(CurrenciesEnum)
	readonly billRateCurrency?: CurrenciesEnum;

	@ApiPropertyOptional({ type: () => String, maxLength: 500 })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	readonly reason?: string;
}
