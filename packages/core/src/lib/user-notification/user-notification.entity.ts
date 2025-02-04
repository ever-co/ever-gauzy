import { ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ID, IUser, IUserNotification, UserNotificationTypeEnum } from '@gauzy/contracts';
import { BasePerEntityType, User } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { UserNotificationTypeTransformerPipe } from '../shared/pipes';
import { MikroOrmUserNotificationRepository } from './repository/mikro-orm-user-notification.repository';

@MultiORMEntity('user_notification', { mikroOrmRepository: () => MikroOrmUserNotificationRepository })
export class UserNotification extends BasePerEntityType implements IUserNotification {
	[EntityRepositoryType]?: MikroOrmUserNotificationRepository;

	/**
	 * The notification title
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	title?: string;

	/**
	 * The notification message
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	message?: string;

	@ApiPropertyOptional({ enum: UserNotificationTypeEnum })
	@IsOptional()
	@IsEnum(UserNotificationTypeEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'int', nullable: true, transformer: new UserNotificationTypeTransformerPipe() })
	type?: UserNotificationTypeEnum; // Will be stored as 0, 1, 2, 3, etc in DB

	/**
	 * Indicates if the notification is read
	 */
	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	isRead?: boolean;

	/**
	 * The date the notification was read
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	readAt?: Date;

	/**
	 * The date till the notification is supposed to be in snooze status
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	onHoldUntil?: Date;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne
    |--------------------------------------------------------------------------
    */

	/**
	 * Optional User notification author
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMManyToOne(() => User, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	sentBy?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: UserNotification) => it.sentBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	sentById?: ID;

	/**
	 * Optional User notification receiver
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMManyToOne(() => User, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	receiver?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: UserNotification) => it.receiver)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	receiverId?: ID;
}
