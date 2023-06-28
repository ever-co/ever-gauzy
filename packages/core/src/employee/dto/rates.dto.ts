import { CurrenciesEnum, PayPeriodEnum } from '@gauzy/contracts';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { TenantOrganizationBaseDTO } from './../../core/dto';

/**
 * Update Employee/Candidate Rates DTO
 */
export class RatesDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String, enum: PayPeriodEnum })
	@IsOptional()
	@IsEnum(PayPeriodEnum)
	readonly payPeriod?: PayPeriodEnum;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Transform((params: TransformFnParams) => parseInt(params.value || 0, 10))
	readonly billRateValue?: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Transform((params: TransformFnParams) => parseInt(params.value || 0, 10))
	readonly minimumBillingRate?: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Transform((params: TransformFnParams) => parseInt(params.value || 0, 10))
	readonly reWeeklyLimit?: number;

	@ApiPropertyOptional({ type: () => String, enum: CurrenciesEnum })
	@IsOptional()
	@IsEnum(CurrenciesEnum)
	readonly billRateCurrency?: string;
}
