import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ID, ITaskTrashFindInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';

/** At most this many trashed tasks per page. */
export const TASK_TRASH_PAGE_LIMIT = 100;

/**
 * The trash `GET /tasks/trash` lists: an organization's (the caller's own, checked as on every organization query),
 * optionally kept to one team or one project, searched by title or number, a page at a time.
 */
export class TaskTrashQueryDTO extends TenantOrganizationBaseDTO implements ITaskTrashFindInput {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly organizationTeamId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly projectId?: ID;

	@ApiPropertyOptional({ type: () => String, maxLength: 200 })
	@IsOptional()
	@IsString()
	@MaxLength(200)
	readonly search?: string;

	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	readonly skip?: number;

	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: TASK_TRASH_PAGE_LIMIT })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(TASK_TRASH_PAGE_LIMIT)
	readonly take?: number;
}
