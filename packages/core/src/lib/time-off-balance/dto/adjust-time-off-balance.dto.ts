import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsUUID, Max, Min } from 'class-validator';
import { ID, ITimeOffBalanceAdjustInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';

/**
 * Spend days from, or give days back to, one employee/policy/year balance.
 *
 * `days` is always positive; the endpoint decides the direction, so a negative value can never
 * turn a deduction into a grant.
 */
export class AdjustTimeOffBalanceDTO extends TenantOrganizationBaseDTO implements ITimeOffBalanceAdjustInput {
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

	@ApiProperty({ type: () => Number, minimum: 0.01 })
	@IsNumber({ maxDecimalPlaces: 2 })
	@Min(0.01)
	@Max(999999)
	readonly days: number;
}
