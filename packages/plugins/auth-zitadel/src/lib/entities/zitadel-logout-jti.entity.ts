import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { BaseEntity, ColumnIndex, MultiORMColumn, MultiORMEntity } from '@gauzy/core';

/**
 * Replay cache of back-channel logout tokens: a `jti` is accepted once. Rows expire after a few
 * minutes and are pruned daily.
 */
@ColumnIndex('IDX_zitadel_logout_jti_jti', ['jti'], { unique: true })
@ColumnIndex('IDX_zitadel_logout_jti_expires_at', ['expiresAt'])
@MultiORMEntity('zitadel_logout_jti')
export class ZitadelLogoutJti extends BaseEntity {
	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn()
	jti: string;

	@ApiProperty({ type: () => Date })
	@MultiORMColumn()
	expiresAt: Date;
}
