import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Normalizes a multipart text part into a boolean (`'true'`/`'1'` → true).
 */
const toBoolean = ({ value }: TransformFnParams): boolean | undefined => {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	if (typeof value === 'boolean') {
		return value;
	}
	return ['true', '1', 'yes'].includes(String(value).toLowerCase());
};

/**
 * Form fields accompanying the single file of `POST /api/plugins/docs/documents/:id/file`
 * (R-UPL-05, replace-in-place).
 *
 * The document already exists, so nothing that identifies or classifies it is accepted here:
 * name, parent, visibility, categories, tags, links, comments and favorites are all preserved
 * by definition. The one decision left to the caller is whether the re-run may spend AI on
 * re-classification.
 */
export class ReplaceDocumentFileDTO {
	/**
	 * Per-request override of the org setting `autoClassify` for the re-run. Omitted = follow
	 * the organization default, exactly as on the upload endpoint.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(toBoolean)
	@IsBoolean()
	readonly classifyWithAi?: boolean;
}
