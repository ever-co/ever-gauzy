import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	Min
} from 'class-validator';
import {
	DocumentKindEnum,
	DocumentVisibilityEnum,
	ID,
	IDocumentCreateInput,
	ITag,
	JsonData
} from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { IsTagReferenceArray } from './document-tag-reference';

/**
 * Create payload for `POST /api/plugins/docs/documents` — FOLDER and PAGE creation only
 * (`kind: FILE` is rejected by the handler: files enter through the upload endpoint).
 */
export class CreateDocumentDTO extends TenantOrganizationBaseDTO implements IDocumentCreateInput {
	@ApiProperty({ type: () => String, enum: DocumentKindEnum })
	@IsEnum(DocumentKindEnum)
	readonly kind: DocumentKindEnum;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	readonly name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly parentId?: ID;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly index?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly icon?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	readonly color?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	readonly description?: string;

	/** PAGE only. Canonical TipTap JSON document. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	readonly contentJson?: JsonData;

	/** PAGE only. Render cache; sanitized server-side before storage. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly contentHtml?: string;

	@ApiPropertyOptional({ type: () => String, enum: DocumentVisibilityEnum })
	@IsOptional()
	@IsEnum(DocumentVisibilityEnum)
	readonly visibility?: DocumentVisibilityEnum;

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	readonly categoryIds?: ID[];

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	readonly tagIds?: ID[];

	/**
	 * The tag shape `IDocumentCreateInput` publishes (`tags?: ITag[]`), accepted alongside
	 * {@link tagIds} and folded into it by `resolveTagIds`.
	 *
	 * 🛑 Declaring only `tagIds` while the contracts interface promised `tags` made the two sides
	 * incoherent: these routes validate with `forbidNonWhitelisted: true`, so the next caller
	 * typed against `@gauzy/contracts` would have got a 400 naming a property its own interface
	 * told it to send. Only the `id` of each entry is read — assigning an existing tag is the
	 * operation, and a document write never creates a tag as a side effect.
	 */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@IsTagReferenceArray()
	readonly tags?: ITag[];

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly importToKnowledge?: boolean;

	/** Employee ids mentioned in the initial content. */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	readonly mentionEmployeeIds?: ID[];
}
