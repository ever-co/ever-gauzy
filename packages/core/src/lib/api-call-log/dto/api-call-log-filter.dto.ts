import { ApiPropertyOptional, IntersectionType, PickType } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { PaginationParams } from '../../core/crud/pagination-params';
import { TenantOrganizationBaseDTO } from '../../core/dto/tenant-organization-base.dto';
import { ApiCallLog } from '../api-call-log.entity';

/**
 * DTO for API call log filtering.
 */
export class ApiCallLogFilterDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
	PickType(PaginationParams, ['skip', 'take', 'order']),
	PickType(ApiCallLog, ['userId', 'ipAddress', 'method'] as const)
) {
	// Correlation ID to filter the request against.
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	correlationId?: ID;

	// Status Code to filter the request against.
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	statusCode?: number;

	// Date range filters for requestTime and responseTime
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	startRequestTime?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	endRequestTime?: Date;
}
