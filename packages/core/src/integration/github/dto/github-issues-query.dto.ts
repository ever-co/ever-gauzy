import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Max, Min } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { IGithubIssueFindInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto';

export class GithubIssuesQueryDTO extends TenantOrganizationBaseDTO implements IGithubIssueFindInput {
	/**
	 * Limit (paginated) - max number of entities should be taken.
	 */
	@ApiPropertyOptional({ type: () => 'number', minimum: 0, maximum: 100 })
	@IsOptional()
	@Min(0)
	@Max(100)
	@Transform((params: TransformFnParams) => parseInt(params.value, 10))
	readonly per_page: number;

	/**
	 * Offset (paginated) where from entities should be taken.
	 */
	@ApiPropertyOptional({ type: () => 'number', minimum: 0 })
	@IsOptional()
	@Min(0)
	@Transform((params: TransformFnParams) => parseInt(params.value, 10))
	readonly page: number;
}
