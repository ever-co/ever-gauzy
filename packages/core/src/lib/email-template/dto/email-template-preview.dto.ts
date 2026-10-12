import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Upper bound for a template sent to a preview endpoint. The largest shipped template is a few
 * tens of KB; 1 MB leaves plenty of room for custom templates while bounding the compile cost.
 */
export const TEMPLATE_PREVIEW_MAX_LENGTH = 1024 * 1024;

/**
 * Body of `POST /email-template/template/preview`: `{ data }`, where `data` is the MJML (email body)
 * or Handlebars (subject) text the editor currently holds. It may be empty or absent while the
 * editor is blank.
 *
 * `data` must be a string: Handlebars.compile() also accepts a pre-parsed AST object
 * (GHSA-48h9-vwf5-h8m7).
 */
export class EmailTemplatePreviewDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(TEMPLATE_PREVIEW_MAX_LENGTH)
	readonly data?: string;
}
