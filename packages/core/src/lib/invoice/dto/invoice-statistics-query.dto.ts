import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { TenantOrganizationBaseDTO } from '../../core/dto';

/**
 * The query of `GET /invoices/statistics`: the organization (checked against the caller's memberships) and
 * whether to total the estimates instead of the invoices.
 */
export class InvoiceStatisticsQueryDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => Boolean, description: 'Total the estimates instead of the invoices.' })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => (value === 'true' ? true : value === 'false' ? false : value))
	@IsBoolean()
	readonly isEstimate?: boolean;
}
