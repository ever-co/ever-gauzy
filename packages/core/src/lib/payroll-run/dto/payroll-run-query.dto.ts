import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ID, IPayrollRunFindInput, PayrollFrequencyEnum, PayrollRunStatusEnum } from '@gauzy/contracts';
import { IsOrganizationBelongsToUser } from './../../shared/validators';

/**
 * Query filters for listing payroll runs.
 */
export class PayrollRunQueryDTO implements IPayrollRunFindInput {
	/**
	 * Required, and checked against the caller's own organizations. Payroll is per organization,
	 * and leaving it optional would let one request list every organization of the tenant.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@IsOrganizationBelongsToUser()
	readonly organizationId: ID;

	@ApiPropertyOptional({ enum: PayrollRunStatusEnum })
	@IsOptional()
	@IsEnum(PayrollRunStatusEnum)
	readonly status?: PayrollRunStatusEnum;

	@ApiPropertyOptional({ enum: PayrollFrequencyEnum })
	@IsOptional()
	@IsEnum(PayrollFrequencyEnum)
	readonly frequency?: PayrollFrequencyEnum;

	@ApiPropertyOptional({ type: () => Date, description: 'Lower bound of the periodStart range' })
	@IsOptional()
	@IsDateString()
	readonly periodStart?: Date;

	@ApiPropertyOptional({ type: () => Date, description: 'Upper bound of the periodStart range' })
	@IsOptional()
	@IsDateString()
	readonly periodEnd?: Date;

	@ApiPropertyOptional({ type: () => Number, description: '1-based page number' })
	@Transform(({ value }: TransformFnParams) => (value === undefined || value === null ? value : Number(value)))
	@IsOptional()
	@IsInt()
	@Min(1)
	readonly page?: number;

	@ApiPropertyOptional({ type: () => Number, description: 'Rows per page, 1-100' })
	@Transform(({ value }: TransformFnParams) => (value === undefined || value === null ? value : Number(value)))
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(100)
	readonly limit?: number;
}
