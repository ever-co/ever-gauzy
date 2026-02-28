import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsNumber, Min, Max } from 'class-validator';

/**
 * DTO for executing a SIM workflow.
 */
export class ExecuteWorkflowDto {
	@ApiPropertyOptional({ description: 'Input data for the workflow' })
	@IsOptional()
	input?: any;

	@ApiPropertyOptional({ description: 'Execution timeout in milliseconds', default: 30000 })
	@IsOptional()
	@IsNumber()
	@Min(1000)
	@Max(300000)
	timeout?: number;

	@ApiPropertyOptional({ description: 'Run asynchronously', default: false })
	@IsOptional()
	@IsBoolean()
	runAsync?: boolean;
}
