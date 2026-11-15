import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { Exclude } from 'class-transformer';
import { IsUUID } from 'class-validator';
import { ID, IUser, IUserTwoFactor } from '@gauzy/contracts';
import { TenantBaseEntity, User } from '../../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../../core/decorators/entity';
import { ExportRedacted } from '../../export-import/export-redact.decorator';
import { SkipExport } from '../../export-import/skip-export.decorator';
import { MikroOrmUserTwoFactorRepository } from './repository/mikro-orm-user-two-factor.repository';

/**
 * A user's two-factor authentication with an authenticator app (see `user-two-factor.service.ts`).
 *
 * One row per user. It exists from the first enrolment on; two-factor authentication is on while `enabledAt` is
 * set. Turning it off, or an administrator's reset, clears the secret and the recovery codes and keeps the row, as
 * the record of the reset.
 *
 * Never exported, and its secret and recovery codes never serialized: they are credentials, not data a tenant
 * authored. The rows go with the user (`userId` cascades).
 */
@SkipExport()
@MultiORMEntity('user_two_factor', { mikroOrmRepository: () => MikroOrmUserTwoFactorRepository })
export class UserTwoFactor extends TenantBaseEntity implements IUserTwoFactor {
	/** The user it protects. */
	@MultiORMManyToOne(() => User, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user?: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: UserTwoFactor) => it.user)
	@IsUUID()
	@ColumnIndex({ unique: true })
	@MultiORMColumn({ relationId: true })
	userId: ID;

	/** The authenticator secret (base32), encrypted at rest (`two-factor-secret.ts`). */
	@ExportRedacted({ blank: true })
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true, hidden: true })
	secret?: string | null;

	/** When the user confirmed their first code. Null while an enrolment waits for it, and once it is turned off. */
	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	enabledAt?: Date | null;

	/** The SHA-256 of each unused recovery code, as a JSON array. */
	@ExportRedacted({ blank: true })
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ type: 'text', nullable: true, hidden: true })
	recoveryCodes?: string | null;

	/**
	 * The last 30-second step whose code was accepted. A code of that step or an earlier one is refused, so a code
	 * read over someone's shoulder cannot be used a second time.
	 */
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ type: 'int', default: 0, hidden: true })
	lastUsedTimeStep?: number;

	/** When an administrator last reset it for the user. */
	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	resetAt?: Date | null;

	/** The administrator who last reset it. */
	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true })
	resetByUserId?: ID | null;
}
