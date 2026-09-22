import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ID, ITimeOffBalanceFindInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';

/**
 * Query filters for listing leave balances.
 */
export class TimeOffBalanceQueryDTO extends TenantOrganizationBaseDTO implements ITimeOffBalanceFindInput {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly employeeId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly policyId?: ID;

	@ApiPropertyOptional({ type: () => Number })
	@Transform(({ value }: TransformFnParams) => (value === undefined || value === null ? value : Number(value)))
	@IsOptional()
	@IsInt()
	@Min(1900)
	@Max(2999)
	readonly year?: number;

	@ApiPropertyOptional({ type: () => Number, description: '1-based page number' })
	@Transform(({ value }: TransformFnParams) => (value === undefined || value === null ? value : Number(value)))
	@IsOptional()
	@IsInt()
	@Min(1)
	readonly page?: number;

	@ApiPropertyOptional({ type: () => Number, description: 'Rows per page, 1-200' })
	@Transform(({ value }: TransformFnParams) => (value === undefined || value === null ? value : Number(value)))
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(200)
	readonly limit?: number;
}
