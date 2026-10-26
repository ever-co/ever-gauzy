import { ApiProperty, ApiPropertyOptional, IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ID, IPayrollItemFindInput, PayrollItemCategoryEnum, PayrollItemTypeEnum } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { IsOrganizationBelongsToUser } from './../../shared/validators';
import { CreatePayrollItemDTO } from './create-payroll-item.dto';

/**
 * Edit one line of a draft payroll run (`PUT /payroll-run/:id/items/:itemId`).
 *
 * Every member of the line is optional and a member left out is left as it is; the organization is
 * required and checked against the caller's memberships, because the run is read under it. The run and the
 * line come from the path, never from the body.
 */
export class UpdatePayrollItemDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
	PartialType(
		PickType(CreatePayrollItemDTO, [
			'employeeId',
			'type',
			'category',
			'description',
			'amount',
			'quantity',
			'unitPrice',
			'taxable'
		] as const)
	)
) {}

/**
 * Query filters for listing payroll lines across runs (`GET /payroll-run/items`).
 */
export class PayrollItemQueryDTO implements IPayrollItemFindInput {
	/**
	 * Required, and checked against the caller's own organizations: payroll is per organization, and an
	 * optional member would let one request list every organization of the tenant.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@IsOrganizationBelongsToUser()
	readonly organizationId: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Only the lines of this run' })
	@IsOptional()
	@IsUUID()
	readonly payrollRunId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Only the lines paid to this employee' })
	@IsOptional()
	@IsUUID()
	readonly employeeId?: ID;

	@ApiPropertyOptional({ enum: PayrollItemTypeEnum })
	@IsOptional()
	@IsEnum(PayrollItemTypeEnum)
	readonly type?: PayrollItemTypeEnum;

	@ApiPropertyOptional({ enum: PayrollItemCategoryEnum })
	@IsOptional()
	@IsEnum(PayrollItemCategoryEnum)
	readonly category?: PayrollItemCategoryEnum;

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
