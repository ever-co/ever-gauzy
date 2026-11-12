import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { ID, IComment, IDocument } from '@gauzy/contracts';
import { ColumnIndex, Comment, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmDocumentCommentAnchorRepository } from '../repositories/mikro-orm-document-comment-anchor.repository';
import { Document } from './document.entity';

/**
 * Where a comment of a page was made: a range of one block's text (`IDocumentCommentAnchorInput` in the contracts).
 *
 * One row per comment (a reply has none: it is on its thread's place). The platform's comment has no field for it, so
 * the Docs plugin keeps it beside the comment, keyed by the comment's id; the comment's first line still carries the
 * `[[block:<blockId>]]` marker, so a client that knows no ranges keeps its block anchor. The row goes with the comment
 * and with the page.
 */
@MultiORMEntity('document_comment_anchor', { mikroOrmRepository: () => MikroOrmDocumentCommentAnchorRepository })
@ColumnIndex('IDX_document_comment_anchor_comment', ['commentId'], { unique: true })
// The page's anchors (`GET /documents/:id/comment-anchors` reads by tenant and page).
@ColumnIndex('IDX_document_comment_anchor_tenant_doc', ['tenantId', 'documentId'])
export class DocumentCommentAnchor extends TenantOrganizationBaseEntity {
	/** The block the range is in (its `blockId` attribute). */
	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(128)
	@MultiORMColumn({ type: 'varchar', length: 128 })
	blockId: string;

	/** The range's first character in the block's text (UTF-16 offset). */
	@ApiProperty({ type: () => Number })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'integer' })
	startOffset: number;

	/** The range's end in the block's text, excluded. */
	@ApiProperty({ type: () => Number })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'integer' })
	endOffset: number;

	/** The text the range covered when the comment was made. */
	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn({ type: 'text' })
	quote: string;

	/** Text right before the range, to tell equal quotes apart. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	prefix?: string | null;

	/** Text right after the range. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	suffix?: string | null;

	/** Base64 `Y.RelativePosition` of the start in the page's shared document (set in a live session). */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 512, nullable: true })
	relativeStart?: string | null;

	/** Base64 `Y.RelativePosition` of the end. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 512, nullable: true })
	relativeEnd?: string | null;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/** The comment. */
	@MultiORMManyToOne(() => Comment, { onDelete: 'CASCADE' })
	@JoinColumn()
	comment?: IComment;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: DocumentCommentAnchor) => it.comment)
	@MultiORMColumn({ relationId: true })
	commentId: ID;

	/** The page the comment is on. */
	@MultiORMManyToOne(() => Document, { onDelete: 'CASCADE' })
	@JoinColumn()
	document?: IDocument;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: DocumentCommentAnchor) => it.document)
	@MultiORMColumn({ relationId: true })
	documentId: ID;
}
