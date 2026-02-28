import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for querying execution history.
 */
export class WorkflowExecutionQueryDto {
	@ApiPropertyOptional({ description: 'Filter by workflow ID' })
	@IsOptional()
	@IsString()
	workflowId?: string;

	@ApiPropertyOptional({ description: 'Filter by execution status' })
	@IsOptional()
	@IsString()
	status?: string;

	@ApiPropertyOptional({ description: 'Number of records to return', default: 20 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(1)
	@Max(100)
	limit?: number;

	@ApiPropertyOptional({ description: 'Number of records to skip', default: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	offset?: number;
}
