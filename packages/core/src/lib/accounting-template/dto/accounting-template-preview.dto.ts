import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { TEMPLATE_PREVIEW_MAX_LENGTH } from './../../email-template/dto/email-template-preview.dto';

/**
 * The `request` part of an accounting template preview: the MJML the editor holds, and the
 * organization NAME the UI shows as the invoice sender (`{{from}}` in the templates).
 */
export class AccountingTemplatePreviewRequestDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(TEMPLATE_PREVIEW_MAX_LENGTH)
	readonly data?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(TEMPLATE_PREVIEW_MAX_LENGTH)
	readonly organization?: string;
}

/**
 * Body of `POST /accounting-template/template/preview`: `{ request: { data, organization } }`,
 * exactly as the web app's AccountingTemplateService.generateTemplatePreview() sends it.
 *
 * `data` must be a string: Handlebars.compile() also accepts a pre-parsed AST object
 * (GHSA-48h9-vwf5-h8m7).
 */
export class AccountingTemplatePreviewDTO {
	@ApiProperty({ type: () => AccountingTemplatePreviewRequestDTO })
	@IsObject()
	@ValidateNested()
	@Type(() => AccountingTemplatePreviewRequestDTO)
	readonly request: AccountingTemplatePreviewRequestDTO;
}
