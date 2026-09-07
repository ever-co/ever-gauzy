import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
	DocumentInboundAddressKindEnum,
	ID,
	IDocumentInboundAddressCreateInput,
	IDocumentInboundAddressUpdateInput
} from '@gauzy/contracts';

/** Upper bound on allowlist entries — a settings field, not a mailing list. */
const MAX_ALLOWLIST_ENTRIES = 200;

/**
 * Normalizes an allowlist supplied either as a real array or as a CSV string (which is what a
 * form control naturally produces).
 */
const parseAllowlist = ({ value }: TransformFnParams): string[] | undefined => {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	const entries = Array.isArray(value) ? value : String(value).split(',');
	return entries
		.map((entry: unknown) => String(entry).trim().toLowerCase())
		.filter((entry: string) => entry.length > 0);
};

/** Scope for the list/read routes. */
export class DocumentInboundAddressQueryDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly organizationId?: ID;
}

/**
 * Create input.
 *
 * `PLATFORM` addresses are minted automatically on first read, so in practice this endpoint is
 * used for `CUSTOM_DOMAIN`. `domain`/`localPart` are validated properly in the service (label by
 * label) — the decorators here only bound the size of what reaches it.
 */
export class CreateDocumentInboundAddressDTO implements IDocumentInboundAddressCreateInput {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly organizationId?: ID;

	@ApiProperty({ type: () => String, enum: DocumentInboundAddressKindEnum })
	@IsEnum(DocumentInboundAddressKindEnum)
	readonly kind: DocumentInboundAddressKindEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly domain?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly localPart?: string;

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@Transform(parseAllowlist)
	@IsArray()
	@ArrayMaxSize(MAX_ALLOWLIST_ENTRIES)
	@IsString({ each: true })
	@MaxLength(320, { each: true })
	readonly senderAllowlist?: string[];

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly importBodyAsNote?: boolean;
}

/**
 * Update input. `kind`, `token`, `domain` and `address` are deliberately absent — they are
 * server-owned, and changing an address is a rotation rather than an edit.
 */
export class UpdateDocumentInboundAddressDTO implements IDocumentInboundAddressUpdateInput {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly organizationId?: ID;

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@Transform(parseAllowlist)
	@IsArray()
	@ArrayMaxSize(MAX_ALLOWLIST_ENTRIES)
	@IsString({ each: true })
	@MaxLength(320, { each: true })
	readonly senderAllowlist?: string[];

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly importBodyAsNote?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isActive?: boolean;
}
