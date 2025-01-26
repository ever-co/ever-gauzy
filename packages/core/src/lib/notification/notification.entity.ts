import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { BaseEntityEnum, ID, INotification, IUser, NotificationTypeEnum } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity, User } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { NotificationTypeTransformerPipe } from '../shared';
import { MikroOrmNotificationRepository } from './repository/mikro-orm-notification.repository';

@MultiORMEntity('notification', { mikroOrmRepository: () => MikroOrmNotificationRepository })
export class Notification extends TenantOrganizationBaseEntity implements INotification {
	[EntityRepositoryType]: MikroOrmNotificationRepository;

	/**
	 * The type of entity type record from which notification was created
	 */
	@ApiProperty({ type: () => String, enum: BaseEntityEnum })
	@IsNotEmpty()
	@IsEnum(BaseEntityEnum)
	@ColumnIndex()
	@MultiORMColumn()
	entity: BaseEntityEnum;

	/**
	 * The ID of entity record from which notification was created
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn()
	entityId: ID;

	/**
	 * The notification title
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	title: string;

	/**
	 * The notification message
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	message: string;

	@ApiPropertyOptional({ enum: NotificationTypeEnum })
	@IsOptional()
	@IsEnum(NotificationTypeEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'int', nullable: true, transformer: new NotificationTypeTransformerPipe() })
	type?: NotificationTypeEnum; // Will be stored as 0, 1, 2, 3, etc in DB

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
	readedAt?: Date;

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
	@RelationId((it: Notification) => it.sentBy)
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
	@RelationId((it: Notification) => it.receiver)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	receiverId?: ID;
}
