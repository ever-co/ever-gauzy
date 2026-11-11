import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { JiraSyncConflictStatus } from '../entities/jira-sync-conflict.entity';
import { JiraSyncDirection } from '../entities/jira-project-mapping.entity';

/**
 * `POST /integration/jira/install/state`: which organization the connection is for. The platform's base DTO checks
 * that the organization is one of the caller's (`IsOrganizationBelongsToUser`), so a state can never be minted for
 * another organization of the tenant.
 */
export class JiraInstallStateDTO extends TenantOrganizationBaseDTO {}

/** `GET /integration/jira/status?organizationId=`: an organization of the caller's. */
export class JiraStatusQueryDTO extends TenantOrganizationBaseDTO {}

/** `PUT /integration/jira/:integrationId/site`: the Jira Cloud site the connection works with (one of `GET …/sites`). */
export class SelectJiraSiteDTO {
	@ApiProperty({ type: String })
	@IsString()
	@MaxLength(64)
	@Matches(/^[A-Za-z0-9-]+$/)
	cloudId!: string;
}

export class CreateJiraMappingDTO {
	@ApiProperty({ type: String })
	@IsString()
	@MaxLength(64)
	@Matches(/^\d+$/)
	jiraProjectId!: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	jiraProjectKey?: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	jiraProjectName?: string;

	@ApiProperty({ type: String })
	@IsUUID()
	projectId!: ID;

	@ApiPropertyOptional({ enum: JiraSyncDirection })
	@IsOptional()
	@IsEnum(JiraSyncDirection)
	direction?: JiraSyncDirection;

	/** Status category (`new`, `indeterminate`, `done`) or `status:<id>` → task status name. */
	@ApiPropertyOptional({ type: Object })
	@IsOptional()
	@IsObject()
	statusMap?: Record<string, string>;

	/** The issue types imported (ids); none for every type. */
	@ApiPropertyOptional({ type: [String] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(100)
	@Matches(/^\d{1,20}$/, { each: true })
	issueTypeIds?: string[];

	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	syncEnabled?: boolean;
}

export class UpdateJiraMappingDTO {
	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsUUID()
	projectId?: ID;

	@ApiPropertyOptional({ enum: JiraSyncDirection })
	@IsOptional()
	@IsEnum(JiraSyncDirection)
	direction?: JiraSyncDirection;

	@ApiPropertyOptional({ type: Object })
	@IsOptional()
	@IsObject()
	statusMap?: Record<string, string>;

	@ApiPropertyOptional({ type: [String] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(100)
	@Matches(/^\d{1,20}$/, { each: true })
	issueTypeIds?: string[];

	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	syncEnabled?: boolean;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	jiraProjectKey?: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	jiraProjectName?: string;
}

/** `POST …/mappings/:mappingId/import`: every issue, or only those changed since the last import. */
export class JiraImportDTO {
	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	full?: boolean;
}

export class JiraRunsQueryDTO {
	@ApiPropertyOptional({ type: Number })
	@IsOptional()
	@Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
	@IsInt()
	@Min(1)
	@Max(200)
	take?: number;
}

/** `GET …/conflicts`: open ones by default; by mapping, task or run. */
export class JiraConflictsQueryDTO {
	@ApiPropertyOptional({ enum: JiraSyncConflictStatus })
	@IsOptional()
	@IsEnum(JiraSyncConflictStatus)
	status?: JiraSyncConflictStatus;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsUUID()
	mappingId?: ID;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsUUID()
	taskId?: ID;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsUUID()
	runId?: ID;

	@ApiPropertyOptional({ type: Number })
	@IsOptional()
	@Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
	@IsInt()
	@Min(1)
	@Max(200)
	take?: number;
}

/** `POST …/conflicts/:conflictId/resolve`: keep Jira's value (already the task's), or write the task's back. */
export class ResolveJiraConflictDTO {
	@ApiProperty({ enum: ['external', 'platform'] })
	@IsIn(['external', 'platform'])
	keep!: 'external' | 'platform';
}
