import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { IPayrollRunCreateInput, PayrollFrequencyEnum } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';

/**
 * Create Payroll Run request DTO.
 *
 * `status` and the totals are intentionally not accepted: the status only moves through the
 * workflow endpoints and the totals are derived from the run's items.
 */
export class CreatePayrollRunDTO extends TenantOrganizationBaseDTO implements IPayrollRunCreateInput {
	@ApiProperty({ type: () => Date })
	@IsNotEmpty()
	@IsDateString()
	readonly periodStart: Date;

	@ApiProperty({ type: () => Date })
	@IsNotEmpty()
	@IsDateString()
	readonly periodEnd: Date;

	@ApiProperty({ type: () => Date })
	@IsNotEmpty()
	@IsDateString()
	readonly payDate: Date;

	@ApiProperty({ enum: PayrollFrequencyEnum })
	@IsEnum(PayrollFrequencyEnum)
	readonly frequency: PayrollFrequencyEnum;

	@ApiProperty({ type: () => String, minLength: 3, maxLength: 3 })
	@IsNotEmpty()
	@IsString()
	@Length(3, 3)
	readonly currency: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 500 })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	readonly notes?: string;
}
