import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import {
	DocumentInboundAddressKindEnum,
	DocumentInboundDomainStatusEnum,
	IDocumentInboundAddress
} from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmDocumentInboundAddressRepository } from '../repositories/mikro-orm-document-inbound-address.repository';

/**
 * An organization's inbound email capture address.
 *
 * ## Why this is its own table
 *
 * The previous design encoded the capture token as a `tenant_setting` row named
 * `docs.<organizationId>.inboundToken`. That has three defects this entity fixes:
 *
 * 1. `tenant_setting` has **no `organizationId` column**, so the organization id was parsed back out
 *    of the setting *name* with `name.split('.')[1]`.
 * 2. It has **no index and no unique constraint** on `name`/`value`, so resolving an inbound message
 *    was a `LIKE 'docs.%.inboundToken'` full-table scan on every delivery, with nothing preventing
 *    two organizations from holding the same token.
 * 3. Nothing ever wrote the row, so resolution always failed and every delivery 404'd.
 *
 * ## The unique index is a security control, not an optimization
 *
 * `IDX_document_inbound_address_address` is UNIQUE across the whole deployment. An inbound message is
 * routed purely by its recipient address, so two rows sharing one address would make the destination
 * tenant depend on row order — a cross-tenant delivery. The database is the right place to make that
 * unrepresentable.
 *
 * ## 🛑 Only `varchar` and `text` are declared explicitly
 *
 * Dates, booleans and integers deliberately carry NO `type:` — TypeORM infers them from the
 * TypeScript type and maps each database appropriately. Writing `type: 'timestamp'` looks harmless
 * and passes every Postgres check, but **better-sqlite3 rejects it outright**
 * (`DataTypeNotSupportedError`) and the API crash-loops at boot. Demo runs SQLite while stage and
 * production run PostgreSQL, so this cannot be caught by testing one of them. No other entity in
 * this plugin declares anything but `varchar`/`text`; keep it that way.
 */
@MultiORMEntity('document_inbound_address', {
	mikroOrmRepository: () => MikroOrmDocumentInboundAddressRepository
})
@ColumnIndex('IDX_document_inbound_address_tenant_org', ['tenantId', 'organizationId'])
export class DocumentInboundAddress extends TenantOrganizationBaseEntity implements IDocumentInboundAddress {
	/**
	 * `PLATFORM` (token on the shared domain) or `CUSTOM_DOMAIN` (the organization's own domain).
	 */
	@ApiProperty({ type: () => String, enum: DocumentInboundAddressKindEnum })
	@IsEnum(DocumentInboundAddressKindEnum)
	@MultiORMColumn({ type: 'varchar', length: 16, default: DocumentInboundAddressKindEnum.PLATFORM })
	kind: DocumentInboundAddressKindEnum;

	/**
	 * Unguessable stem of a `PLATFORM` address (`docs-<token>@…`). 128 bits of CSPRNG entropy, hex.
	 * Null for `CUSTOM_DOMAIN`, where the local part is chosen and therefore guessable — which is
	 * precisely why that kind requires proven domain ownership instead.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex('IDX_document_inbound_address_token')
	@MultiORMColumn({ type: 'varchar', length: 128, nullable: true })
	token?: string | null;

	/**
	 * Lower-cased registrable domain for `CUSTOM_DOMAIN`. Null for `PLATFORM`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	domain?: string | null;

	/**
	 * Chosen local part for `CUSTOM_DOMAIN` (e.g. `docs`). Null for `PLATFORM`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	localPart?: string | null;

	/**
	 * The full resolved address, always lower-cased and maintained by the server. Deliveries are
	 * matched on this column, so it carries the deployment-wide unique index.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@ColumnIndex('IDX_document_inbound_address_address', { unique: true })
	@MultiORMColumn({ type: 'varchar', length: 320 })
	address: string;

	/**
	 * `PLATFORM` rows are created `VERIFIED`; `CUSTOM_DOMAIN` rows start `PENDING` and only accept
	 * mail once the TXT record has actually been observed.
	 */
	@ApiProperty({ type: () => String, enum: DocumentInboundDomainStatusEnum })
	@IsEnum(DocumentInboundDomainStatusEnum)
	@MultiORMColumn({ type: 'varchar', length: 16, default: DocumentInboundDomainStatusEnum.PENDING })
	domainStatus: DocumentInboundDomainStatusEnum;

	/**
	 * The value the organization publishes at `_gauzy-docs.<domain>` IN TXT. Not a secret: it proves
	 * control of DNS, and knowing it grants nothing on its own.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 128, nullable: true })
	domainVerificationToken?: string | null;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	domainVerifiedAt?: Date | null;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	domainLastCheckedAt?: Date | null;

	/**
	 * SHA-256 of the per-address relay secret — never the secret itself. The plaintext is shown once
	 * at creation/rotation and is unrecoverable afterwards, so a database read cannot impersonate the
	 * relay for this address.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	webhookSecretHash?: string | null;

	/**
	 * Permitted senders — bare addresses (`ceo@acme.com`) or domains (`@acme.com`). Empty/null means
	 * "any sender that passes the SPF/DKIM gate". Stored as text and parsed as JSON so the column
	 * behaves identically on PostgreSQL, MySQL and SQLite.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	senderAllowlistRaw?: string | null;

	/**
	 * Import the plain-text body as a note alongside any attachments.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	importBodyAsNote?: boolean;

	/**
	 * A disabled address rejects mail while keeping its history — we never delete capture data.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: true })
	isActive?: boolean;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	lastMessageAt?: Date | null;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@MultiORMColumn({ default: 0 })
	messageCount?: number;

	/**
	 * `senderAllowlistRaw` as a list. Not a column — derived on read.
	 */
	get senderAllowlist(): string[] | null {
		if (!this.senderAllowlistRaw) {
			return null;
		}
		try {
			const parsed = JSON.parse(this.senderAllowlistRaw);
			return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : null;
		} catch {
			// A malformed value must not fail the delivery it is meant to guard; treat it as "unset"
			// so the SPF/DKIM gate still applies.
			return null;
		}
	}
}
