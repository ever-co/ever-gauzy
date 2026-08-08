import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsDefined, IsOptional, IsString, IsUUID } from 'class-validator';
import { ID, JsonData } from '@gauzy/contracts';

/**
 * PAGE content save payload for `PUT /api/plugins/docs/documents/:id/content`.
 *
 * `contentJson` is canonical; the client MAY send `contentHtml` (`editor.getHTML()`) — the server
 * sanitizes it before storing the render cache. A stale `expectedUpdatedAt` yields **409** with
 * `{ code: 'DOCS_CONTENT_CONFLICT', currentUpdatedAt }`; a locked document yields **423**.
 */
export class UpdateDocumentContentDTO {
	@ApiProperty({ type: () => Object, description: 'Canonical TipTap JSON document' })
	@IsDefined()
	readonly contentJson: JsonData;

	@ApiPropertyOptional({ type: () => String, description: 'Render cache (editor.getHTML()), sanitized server-side' })
	@IsOptional()
	@IsString()
	readonly contentHtml?: string;

	/** Optimistic-concurrency token: the `updatedAt` the editor loaded. */
	@ApiProperty({ type: () => Date })
	@IsDateString()
	readonly expectedUpdatedAt: Date;

	/** True bypasses the version-snapshot debounce. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly forceSnapshot?: boolean;

	/** The editor's current mention id set — mention diff-sync runs on content save. */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@IsUUID('all', { each: true })
	readonly mentionEmployeeIds?: ID[];
}
