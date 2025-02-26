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
	 * The employee who sent the notification.
	 *
	 * This property establishes a many-to-one relationship to the Employee entity
	 * representing the sender of the notification. The relation is optional and
	 * is configured to cascade delete the notification if the employee is removed.
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
	sentByEmployee?: IEmployee;

	/**
	 * The ID of the employee who sent the notification.
	 *
	 * This column stores the UUID of the employee linked to the `sentByEmployee` relation.
	 * It is optional, indexed for performance, and automatically populated via the relation.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: EmployeeNotification) => it.sentByEmployee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	sentByEmployeeId?: ID;

	/**
	 * The employee who is set to receive the notification.
	 *
	 * This property establishes a many-to-one relationship to the Employee entity
	 * representing the receiver of the notification. The relation is optional and
	 * is configured to cascade delete the notification if the employee is removed.
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
	receiverEmployee?: IEmployee;

	/**
	 * The ID of the employee who is set to receive the notification.
	 *
	 * This column stores the UUID of the employee linked to the `receiverEmployee` relation.
	 * It is optional, indexed for performance, and automatically populated via the relation.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: EmployeeNotification) => it.receiverEmployee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	receiverEmployeeId?: ID;
}
