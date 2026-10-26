import { AfterLoad } from 'typeorm';
import { OnLoad } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import * as moment from 'moment';
import { IPasswordReset } from '@gauzy/contracts';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { TenantBaseEntity } from './../core/entities/tenant-base.entity';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, VirtualMultiOrmColumn } from './../core/decorators/entity';
import { MikroOrmPasswordResetRepository } from './repository/mikro-orm-password-reset.repository';
import { ExportRedacted } from './../export-import/export-redact.decorator';

@MultiORMEntity('password_reset', { mikroOrmRepository: () => MikroOrmPasswordResetRepository })
export class PasswordReset extends TenantBaseEntity implements IPasswordReset {
	/**
	 * The `email` column stores the user's email address.
	 *
	 * @example "user@example.com"
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsEmail()
	@ColumnIndex()
	@MultiORMColumn()
	email: string;

	/**
	 * Token field to store a long string (text).
	 *
	 */
	@ApiProperty({ type: () => String })
	@ExportRedacted()
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ type: 'text' })
	token: string;

	/**
	 * Virtual column to indicate if the token or record is expired.
	 *
	 * This field is not stored in the database but is computed dynamically.
	 *
	 * @example false
	 */
	@VirtualMultiOrmColumn()
	expired?: boolean;

	/**
	 * Called after entity is loaded to check if the entity is expired.
	 *
	 * On both ORMs, as `TimeLog` does: with `@AfterLoad` alone `expired` was never set under `DB_ORM=mikro-orm`, so
	 * the password reset's "Token has expired" check never refused a stale token (only the JWT's own lifetime did).
	 */
	@AfterLoad()
	@OnLoad()
	afterLoadEntity?() {
		// Calculate the difference between current time and createdAt in minutes
		const expiredAt = moment();
		this.expired = expiredAt.diff(moment(this.createdAt), 'minutes') > 10;
	}
}
