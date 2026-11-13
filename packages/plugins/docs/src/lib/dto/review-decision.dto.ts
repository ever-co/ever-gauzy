import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID } from '@gauzy/contracts';

/**
 * Body of `POST /api/plugins/docs/documents/:id/review/request` (§4.9).
 */
export class RequestReviewDTO {
	@ApiPropertyOptional({ type: () => String, description: 'Why the review is requested' })
	@IsOptional()
	@IsString()
	@MaxLength(1000)
	readonly reason?: string;

	/** The employees asked to review: each gets an Inbox entry (holders of `DOCS_REVIEW` decide either way). */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(50)
	@IsUUID('all', { each: true })
	readonly reviewerEmployeeIds?: ID[];
}

/**
 * Body of `POST /api/plugins/docs/documents/:id/review/approve`.
 */
export class ApproveReviewDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(1000)
	readonly note?: string;
}

/**
 * Body of `POST /api/plugins/docs/documents/:id/review/reject` — same `reason` field name
 * as the bulk `REVIEW_REJECT` payload.
 */
export class RejectReviewDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(1000)
	readonly reason?: string;
}
