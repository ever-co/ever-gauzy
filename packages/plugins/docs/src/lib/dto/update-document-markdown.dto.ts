import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/** The most characters a Markdown update may carry (a page's Markdown; the content route bounds the JSON). */
export const DOCS_MARKDOWN_MAX_LENGTH = 2_000_000;

/**
 * `PUT /documents/:id/content/markdown`: the page's Markdown, and the revision the writer read (a stale one is the
 * content route's 409). The tenant and organization pair is accepted for the client's standard scope and never read
 * for the tenant (the request context's wins); the organization is the editor's selected one, as on the content route.
 */
export class UpdateDocumentMarkdownDTO extends PartialType(TenantOrganizationBaseDTO) {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	override readonly tenantId?: ID;

	@ApiProperty({ type: () => String, description: 'The page as Markdown (the stored subset).' })
	@IsString()
	@MaxLength(DOCS_MARKDOWN_MAX_LENGTH)
	readonly markdown: string;

	@ApiPropertyOptional({ type: () => Number, minimum: 1, description: 'The content revision the writer read; a stale one is refused (409).' })
	@IsOptional()
	@IsInt()
	@Min(1)
	readonly expectedRevision?: number;
}
