import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { TrelloSyncDirection } from '../entities/trello-board-mapping.entity';

/**
 * `POST /integration/trello/install/state`: which organization the connection is for. The platform's base DTO
 * checks that the organization is one of the caller's, so a state is never minted for another organization.
 */
export class TrelloInstallStateDTO extends TenantOrganizationBaseDTO {}

/** `GET /integration/trello/status?organizationId=`: an organization of the caller's. */
export class TrelloStatusQueryDTO extends TenantOrganizationBaseDTO {}

/**
 * `POST /integration/trello/connect`: the token Trello handed the person (from the return page's URL fragment)
 * and the state the flow started with, for an organization of the caller's.
 */
export class TrelloConnectDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: String })
	@IsString()
	@Matches(/^[A-Za-z0-9]{1,256}$/)
	token!: string;

	@ApiProperty({ type: String })
	@IsString()
	@Matches(/^[a-f0-9]{64}$/)
	state!: string;
}

export class CreateTrelloMappingDTO {
	@ApiProperty({ type: String })
	@IsString()
	@Matches(/^[a-f0-9]{24}$/i)
	trelloBoardId!: string;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	trelloBoardName?: string;

	@ApiProperty({ type: String })
	@IsUUID()
	projectId!: ID;

	@ApiPropertyOptional({ enum: TrelloSyncDirection })
	@IsOptional()
	@IsEnum(TrelloSyncDirection)
	direction?: TrelloSyncDirection;

	/** List id → task status name (an archived or done card is always the completed status). */
	@ApiPropertyOptional({ type: Object })
	@IsOptional()
	@IsObject()
	listMap?: Record<string, string>;

	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	syncEnabled?: boolean;
}

export class UpdateTrelloMappingDTO {
	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsUUID()
	projectId?: ID;

	@ApiPropertyOptional({ enum: TrelloSyncDirection })
	@IsOptional()
	@IsEnum(TrelloSyncDirection)
	direction?: TrelloSyncDirection;

	@ApiPropertyOptional({ type: Object })
	@IsOptional()
	@IsObject()
	listMap?: Record<string, string>;

	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	syncEnabled?: boolean;

	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	trelloBoardName?: string;
}

/** `POST …/mappings/:mappingId/import`: every card, or only those changed since the last import. */
export class TrelloImportDTO {
	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	full?: boolean;
}

export class TrelloRunsQueryDTO {
	@ApiPropertyOptional({ type: Number })
	@IsOptional()
	@Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
	@IsInt()
	@Min(1)
	@Max(200)
	take?: number;
}
