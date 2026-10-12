import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** 5 MiB cap on a human-corrected extraction (matches the pipeline extraction cap). */
export const EXTRACTED_TEXT_MAX_LENGTH = 5 * 1024 * 1024;

/**
 * Body of `PUT /api/plugins/docs/documents/:id/extracted-text` — the human correction
 * flow: stores the markdown, sets `extractedTextEdited: true` (permanently protects it
 * from pipeline overwrite), forces `status: READY`, and re-enqueues from `docs.chunk`
 * when the document is in knowledge.
 */
export class UpdateExtractedTextDTO {
	@ApiProperty({ type: () => String, description: 'The corrected extraction markdown (≤ 5 MiB)' })
	@IsNotEmpty()
	@IsString()
	@MaxLength(EXTRACTED_TEXT_MAX_LENGTH)
	readonly extractedText: string;
}
