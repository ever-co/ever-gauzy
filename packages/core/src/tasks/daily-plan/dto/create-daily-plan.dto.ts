import { DailyPlanStatusEnum, IDailyPlanCreateInput, IEmployee } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';
import { TenantBaseDTO } from '../../../core/dto';

/**
 * Create Daily Plan DTO validation
 */

export class CreateDailyPlanDTO extends TenantBaseDTO implements IDailyPlanCreateInput {
	@ApiProperty({ type: () => Date })
	@Type(() => Date)
	@IsNotEmpty()
	@IsDate()
	readonly date: Date;

	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	readonly workTimePlanned: number;

	@ApiProperty({ type: () => String, enum: DailyPlanStatusEnum })
	@IsNotEmpty()
	@IsEnum(DailyPlanStatusEnum, {
		message: 'status `$value` must be a valid enum value'
	})
	readonly status: DailyPlanStatusEnum;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => !it.employee)
	@IsNotEmpty()
	@IsString()
	employeeId: IEmployee['id'];

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.task)
	@IsOptional()
	taskId?: string;
}
