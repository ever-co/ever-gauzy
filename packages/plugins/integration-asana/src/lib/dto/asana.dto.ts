import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { AsanaSyncDirection } from '../entities/asana-project-mapping.entity';

/**
 * `POST /integration/asana/install/state`: which organization the connection is for. The platform's base DTO
 * checks that the organization is one of the caller's, so a state is never minted for another organization.
 */
export class AsanaInstallStateDTO extends TenantOrganizationBaseDTO {}

/** `GET /integration/asana/status?organizationId=`: an organization of the caller's. */
export class AsanaStatusQueryDTO extends TenantOrganizationBaseDTO {}

export class CreateAsanaMappingDTO {
	@ApiProperty({ type: String })
	@IsString()
	@MaxLength(64)
	asanaWorkspaceGid!: string;

	@ApiProperty({ type: String })
	@IsString()
	@MaxLength(64)
	asanaProjectGid!: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	asanaProjectName?: string;

	@ApiProperty({ type: String })
	@IsUUID()
	projectId!: ID;

	@ApiPropertyOptional({ enum: AsanaSyncDirection })
	@IsOptional()
	@IsEnum(AsanaSyncDirection)
	direction?: AsanaSyncDirection;

	/** Section gid → task status name (a completed task is always the completed status). */
	@ApiPropertyOptional({ type: Object })
	@IsOptional()
	@IsObject()
	sectionMap?: Record<string, string>;

	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	syncEnabled?: boolean;
}

export class UpdateAsanaMappingDTO {
	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsUUID()
	projectId?: ID;

	@ApiPropertyOptional({ enum: AsanaSyncDirection })
	@IsOptional()
	@IsEnum(AsanaSyncDirection)
	direction?: AsanaSyncDirection;

	@ApiPropertyOptional({ type: Object })
	@IsOptional()
	@IsObject()
	sectionMap?: Record<string, string>;

	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	syncEnabled?: boolean;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	asanaProjectName?: string;
}

/** `POST …/mappings/:mappingId/import`: every task, or only those changed since the last import. */
export class AsanaImportDTO {
	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	full?: boolean;
}

export class AsanaRunsQueryDTO {
	@ApiPropertyOptional({ type: Number })
	@IsOptional()
	@Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
	@IsInt()
	@Min(1)
	@Max(200)
	take?: number;
}
