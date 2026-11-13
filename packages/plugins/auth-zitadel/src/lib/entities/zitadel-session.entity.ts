import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { RelationId } from 'typeorm';
import { ID, IUser } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, TenantBaseEntity, User } from '@gauzy/core';

/**
 * A Gauzy session that was opened through Ever ID, remembered by the identity provider's session id
 * (`sid`), so a back-channel logout for that `sid` can end exactly the sessions it opened.
 */
@ColumnIndex('IDX_zitadel_session_sid', ['sid'])
@ColumnIndex('IDX_zitadel_session_created_at', ['createdAt'])
@MultiORMEntity('zitadel_session')
export class ZitadelSession extends TenantBaseEntity {
	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn()
	sid: string;

	@MultiORMManyToOne(() => User, {
		/** Database cascade action on delete: the session record goes with the user. */
		onDelete: 'CASCADE'
	})
	user?: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: ZitadelSession) => it.user)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	userId: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	accessTokenId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	refreshTokenId?: ID;

	/**
	 * The Ever ID refresh token of this session, encrypted (AES-256-GCM, by the Ever Platform connection plugin, as it
	 * stores the installation's keys), together with the issuer it came from. Kept only while the App Launcher is on
	 * (`EVER_APP_LAUNCHER_ENABLED=true`), and NULL otherwise. Never selected unless asked for, never serialized, never
	 * returned by a route and never logged; it goes with the session record.
	 */
	@MultiORMColumn({ type: 'text', nullable: true, select: false, hidden: true })
	everRefreshTokenEncrypted?: string | null;
}
