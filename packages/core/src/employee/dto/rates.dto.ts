import { ApiPropertyOptional, IntersectionType, PickType } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { PayPeriodEnum } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { Employee } from '../employee.entity';

/**
 * Update Employee/Candidate Rates DTO
 */
export class RatesDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
	PickType(Employee, ['billRateCurrency'] as const)
) {
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
}
