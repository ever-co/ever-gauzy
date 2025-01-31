import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';
import { isMySQL, isPostgres } from '@gauzy/config';
import { ID, IUser, IUserNotificationSetting, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity, User } from '../../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMOneToOne } from '../../core/decorators/entity';
import { MikroOrmUserNotificationSettingRepository } from './repository/mikro-orm-user-notification-setting.repository';

@MultiORMEntity('user_notification_setting', { mikroOrmRepository: () => MikroOrmUserNotificationSettingRepository })
export class UserNotificationSetting extends TenantOrganizationBaseEntity implements IUserNotificationSetting {
	[EntityRepositoryType]?: MikroOrmUserNotificationSettingRepository;

	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: true })
	payment?: boolean;

	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: true })
	assignment?: boolean;

	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: true })
	invitation?: boolean;

	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: true })
	mention?: boolean;

	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: true })
	comment?: boolean;

	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: true })
	message?: boolean;

	@ApiProperty({ type: () => Object })
	@IsNotEmpty()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text' })
	preferences?: JsonData;

	/*
	|--------------------------------------------------------------------------
	| @OneToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * User
	 */
	@MultiORMOneToOne(() => User, {
		cascade: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE',

		/** This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.  */
		owner: true
	})
	@JoinColumn()
	user?: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: UserNotificationSetting) => it.user)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	userId: ID;
}
