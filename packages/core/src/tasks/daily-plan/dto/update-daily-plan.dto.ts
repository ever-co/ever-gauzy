import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { DailyPlanStatusEnum, IDailyPlanUpdateInput } from '@gauzy/contracts';
import { TenantBaseDTO } from '../../../core/dto';

/**
 * Update Daily Plan DTO validation
 */

export class UpdateDailyPlanDTO extends TenantBaseDTO implements IDailyPlanUpdateInput {
	@ApiProperty({ type: () => Date })
	@Type(() => Date)
	@IsOptional()
	@IsDate()
	readonly date?: Date;

	@ApiProperty({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly workTimePlanned?: number;

	@ApiProperty({ type: () => String, enum: DailyPlanStatusEnum })
	@IsOptional()
	@IsEnum(DailyPlanStatusEnum, { message: 'status `$value` must be a valid enum value' })
	readonly status?: DailyPlanStatusEnum;
}
