import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsNotEmpty, IsObject, IsString, IsUUID, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { IntegrationEntity } from '@gauzy/contracts';

export class EverWorksCreateMappingDto {
	@ApiProperty({ description: 'A pinned Ever Works organization of the connected key (from whoami).' })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	readonly everWorksOrganizationId!: string;

	@ApiPropertyOptional({ description: "The tenant's connection (defaults to the active one)." })
	@ValidateIf((_o, v) => v !== undefined)
	@IsUUID()
	readonly connectionId?: string;
}

export class EverWorksEntitySettingDto {
	@ApiProperty({ enum: IntegrationEntity })
	@IsEnum(IntegrationEntity)
	readonly entity!: IntegrationEntity;

	@ApiProperty()
	@IsBoolean()
	readonly sync!: boolean;
}

export class EverWorksUpdateMappingDto {
	@ApiPropertyOptional({
		description: 'Per-domain direction, e.g. { "tasks": "both", "agents": "ew_to_gauzy", "docs": "off" }.',
		type: Object
	})
	@ValidateIf((_o, v) => v !== undefined)
	@IsObject()
	readonly directions?: Record<string, string>;

	@ApiPropertyOptional({ nullable: true })
	@ValidateIf((_o, v) => v !== undefined && v !== null)
	@IsUUID()
	readonly defaultProjectId?: string | null;

	@ApiPropertyOptional({ nullable: true })
	@ValidateIf((_o, v) => v !== undefined && v !== null)
	@IsUUID()
	readonly ideasProjectId?: string | null;

	@ApiPropertyOptional({ nullable: true })
	@ValidateIf((_o, v) => v !== undefined && v !== null)
	@IsUUID()
	readonly docsRootFolderId?: string | null;

	@ApiPropertyOptional()
	@ValidateIf((_o, v) => v !== undefined)
	@IsBoolean()
	readonly includeHiddenTasks?: boolean;

	@ApiPropertyOptional()
	@ValidateIf((_o, v) => v !== undefined)
	@IsBoolean()
	readonly includeTriageTasks?: boolean;

	@ApiPropertyOptional()
	@ValidateIf((_o, v) => v !== undefined)
	@IsBoolean()
	readonly includeGoalIterationKeyResults?: boolean;

	@ApiPropertyOptional()
	@ValidateIf((_o, v) => v !== undefined)
	@IsBoolean()
	readonly syncUnlinkedProjectTasks?: boolean;

	@ApiPropertyOptional()
	@ValidateIf((_o, v) => v !== undefined)
	@IsBoolean()
	readonly isEnabled?: boolean;

	@ApiPropertyOptional({ type: [EverWorksEntitySettingDto] })
	@ValidateIf((_o, v) => v !== undefined)
	@IsArray()
	@ArrayMaxSize(50)
	@ValidateNested({ each: true })
	@Type(() => EverWorksEntitySettingDto)
	readonly entitySettings?: EverWorksEntitySettingDto[];
}
