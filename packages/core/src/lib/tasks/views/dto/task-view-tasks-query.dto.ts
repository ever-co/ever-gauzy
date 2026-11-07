import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ITaskViewFilterGroup, ITaskViewTasksQuery, TaskViewGroupBy } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { TASK_VIEW_GROUPINGS, TASK_VIEW_PAGE_MAX } from '../view-filters';

/** `GET /task-views/:id/tasks`: the page, the grouping, the caller's time zone, and an override of the view's filter. */
export class TaskViewTasksQueryDTO extends TenantOrganizationBaseDTO implements ITaskViewTasksQuery {
	@ApiPropertyOptional({ type: () => String, description: 'IANA time zone the relative dates are resolved in (default UTC)' })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly timeZone?: string;

	@ApiPropertyOptional({ type: () => String, description: 'The cursor the previous page answered' })
	@IsOptional()
	@IsString()
	@MaxLength(400)
	readonly cursor?: string;

	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: TASK_VIEW_PAGE_MAX })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(TASK_VIEW_PAGE_MAX)
	readonly limit?: number;

	@ApiPropertyOptional({ type: () => String, enum: TASK_VIEW_GROUPINGS })
	@IsOptional()
	@IsIn(TASK_VIEW_GROUPINGS as readonly string[])
	readonly groupBy?: TaskViewGroupBy;

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@Transform(({ value }) => (typeof value === 'string' ? value.split(',').map((item) => item.trim()).filter(Boolean) : value))
	@IsArray()
	@IsString({ each: true })
	readonly relations?: string[];

	/** A filter tree instead of the view's (JSON in the query string); what cannot be applied is reported, not refused. */
	@ApiPropertyOptional({ type: () => Object, description: 'A filter tree (JSON) instead of the view\'s' })
	@IsOptional()
	@Transform(({ value }) => {
		if (typeof value !== 'string') return value;
		try {
			return JSON.parse(value);
		} catch {
			// Passes `@IsObject()` and fails `isFilterGroup`, so the tree is reported as `{ path: 'filter', reason: 'malformed' }`.
			return { op: 'and', conditions: null } as unknown as ITaskViewFilterGroup;
		}
	})
	@IsObject()
	readonly filter?: ITaskViewFilterGroup;
}
