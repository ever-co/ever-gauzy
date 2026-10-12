import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ID, ITimeOffBalanceCarryForwardInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';

/**
 * Roll unused days of one policy from one year into the next.
 */
export class CarryForwardTimeOffBalanceDTO
	extends TenantOrganizationBaseDTO
	implements ITimeOffBalanceCarryForwardInput
{
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly policyId: ID;

	@ApiProperty({ type: () => Number })
	@IsInt()
	@Min(1900)
	@Max(2999)
	readonly fromYear: number;

	@ApiProperty({ type: () => Number })
	@IsInt()
	@Min(1900)
	@Max(2999)
	readonly toYear: number;

	@ApiPropertyOptional({ type: () => Number, description: 'Cap on the days rolled over. Omitted or 0 means no cap.' })
	@IsOptional()
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Max(999999)
	readonly maxCarryForwardDays?: number;
}
