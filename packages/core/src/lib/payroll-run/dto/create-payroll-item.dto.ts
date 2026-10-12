import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	Max,
	Min
} from 'class-validator';
import { ID, IPayrollItemCreateInput, PayrollItemCategoryEnum, PayrollItemTypeEnum } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';

/**
 * Add one earning or deduction line to a payroll run.
 *
 * `payrollRunId` is not part of the body — it comes from the route, so a caller cannot post an
 * item into somebody else's run by naming it here.
 */
export class CreatePayrollItemDTO extends TenantOrganizationBaseDTO implements IPayrollItemCreateInput {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly employeeId: ID;

	@ApiProperty({ enum: PayrollItemTypeEnum })
	@IsEnum(PayrollItemTypeEnum)
	readonly type: PayrollItemTypeEnum;

	@ApiProperty({ enum: PayrollItemCategoryEnum })
	@IsEnum(PayrollItemCategoryEnum)
	readonly category: PayrollItemCategoryEnum;

	@ApiPropertyOptional({ type: () => String, maxLength: 500 })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	readonly description?: string;

	@ApiProperty({ type: () => Number, description: 'Always positive; `category` decides the sign' })
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Max(999999999999)
	readonly amount: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber({ maxDecimalPlaces: 4 })
	@Min(0)
	@Max(999999999999)
	readonly quantity?: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Max(999999999999)
	readonly unitPrice?: number;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly taxable?: boolean;
}
