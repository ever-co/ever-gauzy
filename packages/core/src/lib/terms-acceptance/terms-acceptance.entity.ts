import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrimaryKey } from '@mikro-orm/core';
import { PrimaryColumn } from 'typeorm';
import { termsAcceptanceEntitySchema } from 'terms-acceptance/typeorm';
import type { TermsAcceptanceEntity as ITermsAcceptanceRow } from 'terms-acceptance/typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import { ColumnIndex, JsonColumn, MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { MikroOrmTermsAcceptanceRepository } from './repository/mikro-orm-terms-acceptance.repository';

/**
 * Fail loudly at import time if this entity and the schema published by
 * `terms-acceptance/typeorm` have drifted apart.
 *
 * A silent mismatch would truncate a digest, and a truncated digest is evidence
 * that points at nothing. Better to refuse to boot.
 */
function len(column: keyof typeof termsAcceptanceEntitySchema.columns, expected: number): number {
	const declared = (termsAcceptanceEntitySchema.columns[column] as { length?: number }).length;

	if (declared !== expected) {
		throw new Error(
			`terms_acceptance."${String(column)}" is length ${declared} in terms-acceptance/typeorm but ` +
				`${expected} on the TermsAcceptance entity — reconcile the two and add a migration.`
		);
	}

	return expected;
}

/**
 * Column type for `accepted_at`, per driver.
 *
 * This matters more than it looks. The record's `fingerprint` is a digest over
 * the canonical form of every field *including* `acceptedAt` as an ISO-8601
 * string with millisecond precision, and the service re-verifies that digest on
 * every read. A column that silently drops the milliseconds would make every
 * record read back as tampered — the integrity check would fire on rows nobody
 * ever touched.
 *
 * - Postgres: `timestamptz`, microsecond precision. Exact.
 * - MySQL: `datetime` with `precision: 3`. Plain `datetime` defaults to *zero*
 *   fractional seconds and would truncate.
 * - SQLite: `datetime`, which TypeORM stores as a string carrying milliseconds.
 *
 * A plain string column is not an option here even though the value is
 * conceptually a string: the adapter binds a real `Date` to this column.
 */
function acceptedAtColumnType(): 'timestamptz' | 'datetime' {
	return isPostgres() ? 'timestamptz' : 'datetime';
}

/**
 * An acceptance of a legal document: who agreed to which exact text, when, in
 * what language, from roughly where, and — the field people forget — *how*.
 *
 * ## Why this entity does not extend `TenantBaseEntity`
 *
 * Nearly every other entity in the core does, and gets `id` (a generated uuid),
 * `createdAt` / `updatedAt` / `deletedAt`, `isActive`, `isArchived` and a tenant
 * foreign key for free. This one deliberately does not:
 *
 * 1. **The row is evidence, and evidence is append-only.** `updatedAt`,
 *    `deletedAt` and `isArchived` all describe a row that can legitimately
 *    change after the fact. This one cannot — corrections are made by recording
 *    a *new* acceptance, never by editing an old one. On Postgres the migration
 *    installs a `BEFORE UPDATE OR DELETE` trigger that raises, so the guarantee
 *    is enforced by the database rather than by convention.
 * 2. **The id is not a uuid.** `terms-acceptance` mints its own sortable id
 *    (`ta_…`) and supplies it on insert, so the column is a `varchar(128)` and
 *    not a `@PrimaryGeneratedColumn('uuid')`.
 * 3. **`tenantId` is a scope string, not a foreign key.** Deleting a tenant must
 *    not cascade away the proof that its users once agreed to something.
 *
 * The column set is exactly the one `terms-acceptance/typeorm` publishes, and
 * the lengths are asserted against it at module load.
 */
@MultiORMEntity('terms_acceptance', { mikroOrmRepository: () => MikroOrmTermsAcceptanceRepository })
export class TermsAcceptance implements ITermsAcceptanceRow {
	/**
	 * Identifier minted by `terms-acceptance`, e.g. `ta_m8k2p10000a1b2c3d4e5f6`.
	 *
	 * Declared with both ORMs' own primary-key decorators rather than
	 * `@MultiORMColumn({ primary: true })`. That option only ever reached TypeORM:
	 * `MultiORMColumn` forwards its options to `@Column()` but always emits a plain
	 * MikroORM `@Property()`, so MikroORM saw a table with no primary key and
	 * `discoverEntities` refused to boot the API with
	 * `MetadataError: TermsAcceptance entity is missing @PrimaryKey()`.
	 *
	 * `BaseEntity` stacks the two decorators the same way; it is the pattern in this
	 * codebase for a primary key. The id is supplied on insert, not generated, so
	 * this is `@PrimaryColumn` rather than `@PrimaryGeneratedColumn`.
	 */
	@ApiProperty({ type: () => String })
	@PrimaryKey({ type: 'string', length: len('id', 128) })
	@PrimaryColumn({ type: String, length: len('id', 128) })
	id: string;

	/** The user the acceptance belongs to. Not an FK — see the class comment. */
	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@MultiORMColumn({ name: 'subject_id', type: String, length: len('subjectId', 255) })
	subjectId: string;

	/** Tenant scope, when one user can accept per tenant. */
	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ name: 'tenant_id', type: String, length: len('tenantId', 255), nullable: true })
	tenantId: string | null;

	/** Stable document id, `<document>:<product>` — e.g. `tos:gauzy`. */
	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@MultiORMColumn({ name: 'document_id', type: String, length: len('documentId', 255) })
	documentId: string;

	/** Published version of the document that was accepted. */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({ type: String, length: len('version', 64) })
	version: string;

	/**
	 * Lowercase hex sha256 of the exact document source that was shown.
	 *
	 * This is the field that turns the row from an assertion into evidence: with
	 * it, the wording this person agreed to can be reproduced byte for byte from
	 * the legal corpus years later.
	 */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({ type: String, length: len('sha256', 64) })
	sha256: string;

	/** ISO-8601 UTC instant the acceptance happened. */
	@ApiProperty({ type: () => 'timestamptz' })
	@MultiORMColumn({
		name: 'accepted_at',
		type: acceptedAtColumnType(),
		...(isMySQL() ? { precision: 3 } : {})
	})
	acceptedAt: Date | string;

	/** BCP-47 locale of the text that was shown. */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({ type: String, length: len('locale', 35) })
	locale: string;

	/** Salted sha256 of the client IP. Never a raw address. */
	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ name: 'ip_hash', type: String, length: len('ipHash', 64), nullable: true })
	ipHash: string | null;

	/** Client user-agent, truncated by the package to 512 characters. */
	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ name: 'user_agent', type: String, length: len('userAgent', 512), nullable: true })
	userAgent: string | null;

	/** How consent was obtained — `signup-checkbox`, `invite-accept`, … */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({ type: String, length: len('method', 64) })
	method: string;

	/** Free-form, non-authoritative context. Never anything sensitive. */
	@ApiPropertyOptional({ type: () => Object })
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata: Record<string, unknown> | null;

	/**
	 * sha256 over the canonical form of every other field. The service
	 * recomputes it on every read, so a row rewritten by someone with database
	 * access fails loudly instead of lying quietly.
	 */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({ type: String, length: len('fingerprint', 64) })
	fingerprint: string;
}
