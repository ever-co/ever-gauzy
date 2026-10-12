import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Body of `POST /api/plugins/docs/documents/:id/reprocess` — re-runs the pipeline from
 * `docs.extract` for a FILE document.
 *
 * `extractedTextEdited && !overwriteEdited` → 409 `DOCS_EXTRACTED_TEXT_EDITED` (a human
 * correction is never silently overwritten). `ocr: true` requests the OCR path (P1,
 * delivered M5, env-gated).
 */
export class ReprocessDocumentDTO {
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly force?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly ocr?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly overwriteEdited?: boolean;
}
