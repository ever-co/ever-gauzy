import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { Exclude } from 'class-transformer';
import { IsUUID } from 'class-validator';
import { ID, IUser, IUserApiToken } from '@gauzy/contracts';
import { TenantBaseEntity, User } from '../../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../../core/decorators/entity';
import { ExportRedacted } from '../../export-import/export-redact.decorator';
import { SkipExport } from '../../export-import/skip-export.decorator';
import { MikroOrmUserApiTokenRepository } from './repository/mikro-orm-user-api-token.repository';

/**
 * A personal API token (see `user-api-token.service.ts`).
 *
 * The token itself is never stored, only its SHA-256, and it is returned once, when it is created.
 *
 * Never exported: a credential is not data a tenant authored, and an import must not bring a working token onto
 * another server. The mark on the hash keeps it out of an archive should that ever change.
 *
 * The rows go with the user (`userId` cascades), so deleting an account, the self-service GDPR deletion included,
 * deletes them. A revoked row stays, as the record of when the token stopped working.
 */
@SkipExport()
@MultiORMEntity('user_api_token', { mikroOrmRepository: () => MikroOrmUserApiTokenRepository })
export class UserApiToken extends TenantBaseEntity implements IUserApiToken {
	/** The user whose role and permissions the token carries. */
	@MultiORMManyToOne(() => User, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user?: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: UserApiToken) => it.user)
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	userId: ID;

	/** What the user called it. */
	@ApiProperty({ type: () => String, maxLength: 100 })
	@MultiORMColumn({ length: 100 })
	name: string;

	/** SHA-256 (hex) of the token. */
	@ExportRedacted({ blank: true })
	@Exclude({ toPlainOnly: true })
	@ColumnIndex({ unique: true })
	@MultiORMColumn({ length: 64 })
	tokenHash: string;

	/** The first characters of the token (`gzp_` + 8), not secret, so the list can tell tokens apart. */
	@ApiProperty({ type: () => String, maxLength: 20 })
	@MultiORMColumn({ length: 20 })
	prefix: string;

	/** When it stops working. Null: never. */
	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	expiresAt: Date | null;

	/** When it was last exchanged, accurate to about a minute (`USER_API_TOKEN_LAST_USED_RESOLUTION_MS`). */
	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	lastUsedAt: Date | null;

	/** When it was revoked. A revoked token never works again. */
	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	revokedAt: Date | null;
}
