import { ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ID, IEmployeeNotification, EmployeeNotificationTypeEnum, IEmployee } from '@gauzy/contracts';
import { BasePerEntityType, Employee } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { EmployeeNotificationTypeTransformer } from './employee-notification-type-transform';
import { MikroOrmEmployeeNotificationRepository } from './repository/mikro-orm-employee-notification.repository';

@MultiORMEntity('employee_notification', { mikroOrmRepository: () => MikroOrmEmployeeNotificationRepository })
export class EmployeeNotification extends BasePerEntityType implements IEmployeeNotification {
	[EntityRepositoryType]?: MikroOrmEmployeeNotificationRepository;

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

	/**
	 * The notification type
	 */
	@ApiPropertyOptional({ enum: EmployeeNotificationTypeEnum })
	@IsOptional()
	@IsEnum(EmployeeNotificationTypeEnum)
	@ColumnIndex()
	@MultiORMColumn({
		type: 'int',
		nullable: true,
		transformer: new EmployeeNotificationTypeTransformer()
	})
	type?: EmployeeNotificationTypeEnum; // Will be stored as 0, 1, 2, 3, etc in DB

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
	 * Optional Employee notification author
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMManyToOne(() => Employee, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	sentBy?: IEmployee;

	/**
	 * The UUID of the associated employee.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: EmployeeNotification) => it.sentBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	sentById?: ID;

	/**
	 * Optional Employee notification receiver
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMManyToOne(() => Employee, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	receiver?: IEmployee;

	/**
	 * The UUID of the associated employee.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: EmployeeNotification) => it.receiver)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	receiverId?: ID;
}
