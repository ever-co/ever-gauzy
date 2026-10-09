import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsUUID, Max, Min } from 'class-validator';
import { ID, ITimeOffBalanceAllocateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';

/**
 * Set the accrued days of one employee/policy/year balance.
 */
export class AllocateTimeOffBalanceDTO extends TenantOrganizationBaseDTO implements ITimeOffBalanceAllocateInput {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly employeeId: ID;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly policyId: ID;

	@ApiProperty({ type: () => Number })
	@IsInt()
	@Min(1900)
	@Max(2999)
	readonly year: number;

	@ApiProperty({ type: () => Number })
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0)
	@Max(999999)
	readonly accrued: number;
}
