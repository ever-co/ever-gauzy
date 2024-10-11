import { ApiPropertyOptional, IntersectionType, PickType } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { PaginationParams } from '../../core/crud/pagination-params';
import { TenantOrganizationBaseDTO } from '../../core/dto/tenant-organization-base.dto';
import { ApiCallLog } from '../api-call-log.entity';

/**
 * DTO for API call log filtering.
 */
export class ApiCallLogFilterDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
	PickType(PaginationParams, ['skip', 'take', 'order']),
	PickType(ApiCallLog, ['userId', 'ipAddress'] as const)
) {
	// Correlation ID to filter the request against.
	@ApiPropertyOptional()
	@IsOptional()
	@IsUUID()
	correlationId?: string;

	// Status Code to filter the request against.
	@ApiPropertyOptional()
	@IsOptional()
	@IsNumber()
	statusCode?: number;

	// Date range filters for requestTime and responseTime
	@ApiPropertyOptional()
	@IsOptional()
	@IsDateString()
	startRequestTime?: Date;

	@ApiPropertyOptional()
	@IsOptional()
	@IsDateString()
	endRequestTime?: Date;
}
