import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DocumentVisibilityEnum, ID, IDocumentImportCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/** An empty multipart text part is no value (a form sends `parentId=` for "no parent"). */
const emptyToUndefined = ({ value }: TransformFnParams): unknown => (value === '' || value === null || value === 'null' ? undefined : value);

/**
 * The target of `POST /api/plugins/docs/imports` (multipart text parts beside the `file`): a parent page or folder the
 * caller may write, or a space. `organizationId` is the platform's organization check (`TenantOrganizationBaseDTO`).
 */
export class CreateDocumentImportDTO extends PartialType(TenantOrganizationBaseDTO) implements IDocumentImportCreateInput {
	@ApiPropertyOptional({ type: () => String, description: 'A page or folder the caller may write; the pages land under it.' })
	@IsOptional()
	@Transform(emptyToUndefined)
	@IsUUID()
	readonly parentId?: ID;

	@ApiPropertyOptional({ type: () => String, enum: DocumentVisibilityEnum, description: 'The space when no parent is given.' })
	@IsOptional()
	@Transform(emptyToUndefined)
	@IsEnum(DocumentVisibilityEnum)
	readonly visibility?: DocumentVisibilityEnum;

	@ApiPropertyOptional({ type: () => String, description: 'The team of a TEAM space.' })
	@IsOptional()
	@Transform(emptyToUndefined)
	@IsUUID()
	readonly organizationTeamId?: ID;
}
