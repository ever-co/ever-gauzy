import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import {
	ID,
	ITaskAutomationAction,
	ITaskAutomationCondition,
	ITaskAutomationRuleCreateInput,
	ITaskAutomationRuleUpdateInput,
	ITaskAutomationTrigger,
	TASK_AUTOMATION_LIMITS
} from '@gauzy/contracts';

/** The organization a request names (it must be the one the request works in). */
export class TaskAutomationOrganizationDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	organizationId?: ID;
}

/** `GET /task-automations`: optionally only the rules of a project or a team. */
export class TaskAutomationListQueryDTO extends TaskAutomationOrganizationDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	projectId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	organizationTeamId?: ID;
}

/**
 * A rule's editable fields. The trigger, conditions and actions are checked by the service (types, values, sizes and
 * that what they name is the organization's): the DTO only bounds their shape.
 */
export class TaskAutomationRuleUpdateDTO extends TaskAutomationOrganizationDTO implements ITaskAutomationRuleUpdateInput {
	@ApiPropertyOptional({ type: () => String, maxLength: TASK_AUTOMATION_LIMITS.nameLength })
	@IsOptional()
	@IsString()
	@MaxLength(TASK_AUTOMATION_LIMITS.nameLength)
	name?: string;

	@ApiPropertyOptional({ type: () => String, nullable: true })
	@IsOptional()
	@ValidateIf((_, value) => value !== null)
	@IsString()
	@MaxLength(TASK_AUTOMATION_LIMITS.descriptionLength)
	description?: string | null;

	@ApiPropertyOptional({ type: () => String, nullable: true })
	@IsOptional()
	@ValidateIf((_, value) => value !== null)
	@IsUUID()
	projectId?: ID | null;

	@ApiPropertyOptional({ type: () => String, nullable: true })
	@IsOptional()
	@ValidateIf((_, value) => value !== null)
	@IsUUID()
	organizationTeamId?: ID | null;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	isEnabled?: boolean;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	trigger?: ITaskAutomationTrigger;

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(TASK_AUTOMATION_LIMITS.conditionsPerRule)
	conditions?: ITaskAutomationCondition[];

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(TASK_AUTOMATION_LIMITS.actionsPerRule)
	actions?: ITaskAutomationAction[];
}

/** A new rule: blank, or from a template that fills what the body leaves out. */
export class TaskAutomationRuleCreateDTO extends TaskAutomationRuleUpdateDTO implements ITaskAutomationRuleCreateInput {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	templateKey?: string;
}

/** `PUT /task-automations/order`. */
export class TaskAutomationReorderDTO extends TaskAutomationOrganizationDTO {
	@ApiProperty({ type: () => [String] })
	@IsArray()
	@ArrayMaxSize(TASK_AUTOMATION_LIMITS.rulesPerOrganization)
	@IsUUID('all', { each: true })
	ids!: ID[];
}

/** `POST /task-automations/:id/test`. */
export class TaskAutomationTestDTO extends TaskAutomationOrganizationDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	taskId!: ID;
}

/** `GET /task-automations/:id/runs`. */
export class TaskAutomationRunsQueryDTO extends TaskAutomationOrganizationDTO {
	@ApiPropertyOptional({ type: () => Number, maximum: TASK_AUTOMATION_LIMITS.runsShown })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(TASK_AUTOMATION_LIMITS.runsShown)
	limit?: number;
}
