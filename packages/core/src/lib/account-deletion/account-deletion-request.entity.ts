import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { IAccountDeletionRequest } from '@gauzy/contracts';
import { BaseEntity } from '../core/entities/base.entity';
import { ColumnIndex, MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { ExportRedacted } from '../export-import/export-redact.decorator';
import { MikroOrmAccountDeletionRequestRepository } from './repository/mikro-orm-account-deletion-request.repository';

/**
 * One "email me a link to delete my account" request (see `account-deletion.service.ts`).
 *
 * Not tenant scoped: one address can own accounts in several tenants, and the request covers them all.
 * The emailed token is never stored, only its SHA-256. Once the deletion has run, `email` is cleared
 * and the row stays as the audit record of the request (`emailHash`, timestamps, `result` counts).
 */
@MultiORMEntity('account_deletion_request', { mikroOrmRepository: () => MikroOrmAccountDeletionRequestRepository })
export class AccountDeletionRequest extends BaseEntity implements IAccountDeletionRequest {
	/** The address the request was made for; cleared once the deletion ran or the link expired unused. */
	@ApiPropertyOptional({ type: () => String })
	@ExportRedacted()
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ nullable: true })
	email?: string | null;

	/** SHA-256 (hex) of the lower-cased address: what the per-address limit counts, and the audit trail. */
	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@MultiORMColumn({ length: 64 })
	emailHash: string;

	/** SHA-256 (hex) of the emailed token. */
	@ApiProperty({ type: () => String })
	@ExportRedacted()
	@Exclude({ toPlainOnly: true })
	@ColumnIndex({ unique: true })
	@MultiORMColumn({ length: 64 })
	tokenHash: string;

	/** When the link stops working. */
	@ApiProperty({ type: () => Date })
	@MultiORMColumn()
	expiresAt: Date;

	/**
	 * When a confirm claimed the link. A lease: a claim that never completed (the process died mid-way) can be
	 * taken again after a few minutes, while the link has not expired.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	usedAt?: Date | null;

	/**
	 * Which confirm holds the claim (a random id): renewing, completing and releasing a claim check it, so a
	 * confirm that lost its claim can no longer write. An id, not the `usedAt` timestamp, because MySQL drops
	 * the milliseconds of a `datetime` and an equality on it would never match.
	 */
	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true, length: 36 })
	claimId?: string | null;

	/** When the deletion finished. A completed link never works again. */
	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	completedAt?: Date | null;

	/** When a newer request for the same address replaced this one before it was used. */
	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	revokedAt?: Date | null;

	/** SHA-256 (hex) of the client address the request came from. */
	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true, length: 64 })
	requestIpHash?: string | null;

	/** The requesting browser, truncated to 255 characters. */
	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true })
	userAgent?: string | null;

	/** The language the emails are sent in. */
	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true, length: 20 })
	locale?: string | null;

	/**
	 * JSON of the branding the request asked for (app name, logo, links already checked against the origins
	 * this deployment serves), so the "deleted" email speaks for the same app as the link email.
	 */
	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ type: 'text', nullable: true })
	branding?: string | null;

	/** JSON summary of what the deletion removed (counts only). */
	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ type: 'text', nullable: true })
	result?: string | null;
}
