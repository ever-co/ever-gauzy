import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import {
	DocumentInboundAddressKindEnum,
	IDocumentInboundAddressCreateInput,
	IDocumentInboundAddressUpdateInput
} from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

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

/**
 * Scope for the list/read routes, and for the verify/rotate bodies.
 *
 * Every DTO of this file names the organization whose capture addresses the request reads or manages. It used to be
 * a bare `@IsUUID()`, so any DOCS_READ holder could name another organization of the tenant and read — and, on first
 * read, mint — its platform capture address (the credential that drops mail into that organization's documents), and
 * a DOCS_MANAGE holder could rotate, disable or re-route another organization's addresses. Extending a partial
 * `TenantOrganizationBaseDTO`, like the documents' other scope DTOs, applies the platform's
 * `@IsOrganizationBelongsToUser()` check. When omitted, the controller falls back to the requester's organization.
 */
export class DocumentInboundAddressQueryDTO extends PartialType(TenantOrganizationBaseDTO) {}

/**
 * Create input.
 *
 * `PLATFORM` addresses are minted automatically on first read, so in practice this endpoint is
 * used for `CUSTOM_DOMAIN`. `domain`/`localPart` are validated properly in the service (label by
 * label) — the decorators here only bound the size of what reaches it.
 */
export class CreateDocumentInboundAddressDTO
	extends PartialType(TenantOrganizationBaseDTO)
	implements IDocumentInboundAddressCreateInput
{
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
export class UpdateDocumentInboundAddressDTO
	extends PartialType(TenantOrganizationBaseDTO)
	implements IDocumentInboundAddressUpdateInput
{
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
