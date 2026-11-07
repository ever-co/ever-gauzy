import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { LinearSyncDirection } from '../entities/linear-team-mapping.entity';

/** `POST /integration/linear/install/state`: which organization the connection is for. */
export class LinearInstallStateDTO {
	@ApiProperty({ type: String })
	@IsUUID()
	organizationId!: ID;
}

/** `GET /integration/linear/status?organizationId=`. */
export class LinearStatusQueryDTO {
	@ApiProperty({ type: String })
	@IsUUID()
	organizationId!: ID;
}

export class CreateLinearMappingDTO {
	@ApiProperty({ type: String })
	@IsString()
	@MaxLength(64)
	linearTeamId!: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	linearTeamKey?: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	linearTeamName?: string;

	@ApiProperty({ type: String })
	@IsUUID()
	projectId!: ID;

	@ApiPropertyOptional({ enum: LinearSyncDirection })
	@IsOptional()
	@IsEnum(LinearSyncDirection)
	direction?: LinearSyncDirection;

	/** Linear state kind (`triage`, `backlog`, `unstarted`, `started`, `completed`, `canceled`) → task status name. */
	@ApiPropertyOptional({ type: Object })
	@IsOptional()
	@IsObject()
	stateMap?: Record<string, string>;

	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	syncEnabled?: boolean;
}

export class UpdateLinearMappingDTO {
	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsUUID()
	projectId?: ID;

	@ApiPropertyOptional({ enum: LinearSyncDirection })
	@IsOptional()
	@IsEnum(LinearSyncDirection)
	direction?: LinearSyncDirection;

	@ApiPropertyOptional({ type: Object })
	@IsOptional()
	@IsObject()
	stateMap?: Record<string, string>;

	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	syncEnabled?: boolean;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	linearTeamKey?: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	linearTeamName?: string;
}

/** `POST …/mappings/:mappingId/import`: every issue, or only those changed since the last import. */
export class LinearImportDTO {
	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	full?: boolean;
}

export class LinearRunsQueryDTO {
	@ApiPropertyOptional({ type: Number })
	@IsOptional()
	@Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
	@IsInt()
	@Min(1)
	@Max(200)
	take?: number;
}
