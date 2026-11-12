import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { IDocumentCommentAnchorInput } from '@gauzy/contracts';
import { DocumentScopeQueryDTO } from './document-scope-query.dto';

/**
 * `PUT /documents/:id/comments/:commentId/anchor`: where the comment was made, a range of one block's text.
 *
 * The service checks the rest (`normaliseAnchorInput`: the quote is the range's text, both relative positions or
 * neither); the organization is the selected one, as on the other single-document routes.
 */
export class SetDocumentCommentAnchorDTO extends DocumentScopeQueryDTO implements IDocumentCommentAnchorInput {
	@ApiProperty({ type: () => String, description: 'The block (its `blockId` attribute).' })
	@IsString()
	@Matches(/^[A-Za-z0-9._:-]{1,128}$/)
	readonly blockId: string;

	@ApiProperty({ type: () => Number, description: "The range's first character in the block's text (UTF-16 offset)." })
	@IsInt()
	@Min(0)
	@Max(10_000_000)
	readonly start: number;

	@ApiProperty({ type: () => Number, description: "The range's end in the block's text, excluded." })
	@IsInt()
	@Min(0)
	@Max(10_000_000)
	readonly end: number;

	@ApiProperty({ type: () => String, description: "The range's text (at most 1000 characters)." })
	@IsString()
	@MaxLength(1000)
	readonly quote: string;

	@ApiPropertyOptional({ type: () => String, description: 'Up to 32 characters before the range.' })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	readonly prefix?: string | null;

	@ApiPropertyOptional({ type: () => String, description: 'Up to 32 characters after the range.' })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	readonly suffix?: string | null;

	@ApiPropertyOptional({ type: () => String, description: 'Base64 Y.RelativePosition of the start (live sessions).' })
	@IsOptional()
	@IsString()
	@MaxLength(512)
	readonly relativeStart?: string | null;

	@ApiPropertyOptional({ type: () => String, description: 'Base64 Y.RelativePosition of the end (live sessions).' })
	@IsOptional()
	@IsString()
	@MaxLength(512)
	readonly relativeEnd?: string | null;
}
