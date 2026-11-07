import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { DocumentVisibilityEnum, ID, IDocumentSpaceMoveInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * Body of `POST /api/plugins/docs/documents/:id/space`: the space a page (and, by default, the descendants the
 * caller may write) moves to. `TEAM` names the team; the other visibilities carry none.
 */
export class MoveDocumentSpaceDTO extends PartialType(TenantOrganizationBaseDTO) implements IDocumentSpaceMoveInput {
	@ApiProperty({ type: () => String, enum: DocumentVisibilityEnum })
	@IsEnum(DocumentVisibilityEnum)
	readonly visibility: DocumentVisibilityEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@ValidateIf((it) => it.organizationTeamId !== null)
	@IsUUID()
	readonly organizationTeamId?: ID | null;

	/** Also move every descendant the caller may write (default true). */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly applyToSubtree?: boolean;
}
