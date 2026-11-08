import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsDateString,
	IsEnum,
	IsInt,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
	ValidateIf,
	ValidateNested
} from 'class-validator';
import {
	ID,
	ITaskBuiltInViewQuery,
	ITaskBulkChanges,
	ITaskBulkUpdateInput,
	ITaskBulkUpdateItem,
	ITaskReferenceResolveInput,
	TASK_BULK_UPDATE_MAX,
	TaskPriorityEnum,
	TaskSizeEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { TASK_REFERENCES_MAX } from '../task-reference';

const nullOrUuid = (it: Record<string, unknown>, key: string) => it[key] !== null && it[key] !== undefined;
const toNullOrDate = ({ value }: { value: unknown }) => (value === null || value === '' ? null : value);

/** What a bulk update changes on a task; every field optional, `null` clears a nullable field. */
export class TaskBulkChangesDTO implements ITaskBulkChanges {
	@ApiPropertyOptional({ enum: TaskStatusEnum, nullable: true })
	@IsOptional()
	@ValidateIf((it) => nullOrUuid(it, 'status'))
	@IsEnum(TaskStatusEnum)
	readonly status?: TaskStatusEnum | null;

	@ApiPropertyOptional({ type: () => String, nullable: true })
	@IsOptional()
	@ValidateIf((it) => nullOrUuid(it, 'taskStatusId'))
	@IsUUID()
	readonly taskStatusId?: ID | null;

	@ApiPropertyOptional({ enum: TaskPriorityEnum, nullable: true })
	@IsOptional()
	@ValidateIf((it) => nullOrUuid(it, 'priority'))
	@IsEnum(TaskPriorityEnum)
	readonly priority?: TaskPriorityEnum | null;

	@ApiPropertyOptional({ type: () => String, nullable: true })
	@IsOptional()
	@ValidateIf((it) => nullOrUuid(it, 'taskPriorityId'))
	@IsUUID()
	readonly taskPriorityId?: ID | null;

	@ApiPropertyOptional({ enum: TaskSizeEnum, nullable: true })
	@IsOptional()
	@ValidateIf((it) => nullOrUuid(it, 'size'))
	@IsEnum(TaskSizeEnum)
	readonly size?: TaskSizeEnum | null;

	@ApiPropertyOptional({ type: () => String, nullable: true })
	@IsOptional()
	@ValidateIf((it) => nullOrUuid(it, 'taskSizeId'))
	@IsUUID()
	readonly taskSizeId?: ID | null;

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	readonly addTagIds?: ID[];

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	readonly removeTagIds?: ID[];

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	readonly setTagIds?: ID[];

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	readonly addMemberIds?: ID[];

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	readonly removeMemberIds?: ID[];

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	readonly setMemberIds?: ID[];

	@ApiPropertyOptional({ type: () => String, nullable: true })
	@IsOptional()
	@ValidateIf((it) => nullOrUuid(it, 'projectId'))
	@IsUUID()
	readonly projectId?: ID | null;

	@ApiPropertyOptional({ type: () => String, nullable: true })
	@IsOptional()
	@ValidateIf((it) => nullOrUuid(it, 'organizationSprintId'))
	@IsUUID()
	readonly organizationSprintId?: ID | null;

	@ApiPropertyOptional({ type: () => Date, nullable: true })
	@IsOptional()
	@Transform(toNullOrDate)
	@ValidateIf((it) => nullOrUuid(it, 'dueDate'))
	@IsDateString()
	readonly dueDate?: Date | null;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isArchived?: boolean;
}

export class TaskBulkUpdateItemDTO implements ITaskBulkUpdateItem {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly taskId: ID;

	@ApiProperty({ type: () => TaskBulkChangesDTO })
	@IsObject()
	@ValidateNested()
	@Type(() => TaskBulkChangesDTO)
	readonly changes: TaskBulkChangesDTO;
}

/** `POST /tasks/bulk-update`: one change for many tasks, or a change per task (an undo sends the previous values). */
export class TaskBulkUpdateDTO extends TenantOrganizationBaseDTO implements ITaskBulkUpdateInput {
	@ApiPropertyOptional({ type: () => Array, description: `Up to ${TASK_BULK_UPDATE_MAX} task ids` })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(TASK_BULK_UPDATE_MAX)
	@IsUUID('all', { each: true })
	readonly taskIds?: ID[];

	@ApiPropertyOptional({ type: () => TaskBulkChangesDTO })
	@IsOptional()
	@IsObject()
	@ValidateNested()
	@Type(() => TaskBulkChangesDTO)
	readonly changes?: TaskBulkChangesDTO;

	@ApiPropertyOptional({ type: () => [TaskBulkUpdateItemDTO], description: `Up to ${TASK_BULK_UPDATE_MAX} items` })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(TASK_BULK_UPDATE_MAX)
	@ValidateNested({ each: true })
	@Type(() => TaskBulkUpdateItemDTO)
	readonly items?: TaskBulkUpdateItemDTO[];
}

/** `POST /tasks/resolve-references`: `KEY-number` references, at most fifty. */
export class TaskReferenceResolveDTO extends TenantOrganizationBaseDTO implements ITaskReferenceResolveInput {
	@ApiProperty({ type: () => Array, description: `Up to ${TASK_REFERENCES_MAX} references such as API-42` })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(TASK_REFERENCES_MAX)
	@IsString({ each: true })
	@MaxLength(40, { each: true })
	readonly references: string[];
}

/** `GET /tasks/built-in/:key`: the caller's time zone and the page. */
export class TaskBuiltInViewQueryDTO extends TenantOrganizationBaseDTO implements ITaskBuiltInViewQuery {
	@ApiPropertyOptional({ type: () => String, description: 'IANA time zone (default UTC)' })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly timeZone?: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(200)
	readonly take?: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	readonly skip?: number;

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@Transform(({ value }) => (typeof value === 'string' ? value.split(',').map((item) => item.trim()).filter(Boolean) : value))
	@IsArray()
	@IsString({ each: true })
	readonly relations?: string[];
}
