import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { isMySQL, isPostgres } from '@gauzy/config';
import { ID, IEmployeeNotificationSetting, JsonData, IEmployee } from '@gauzy/contracts';
import { Employee, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMOneToOne } from '../core/decorators/entity';
import { MikroOrmEmployeeNotificationSettingRepository } from './repository/mikro-orm-employee-notification-setting.repository';

@MultiORMEntity('employee_notification_setting', {
	mikroOrmRepository: () => MikroOrmEmployeeNotificationSettingRepository
})
export class EmployeeNotificationSetting extends TenantOrganizationBaseEntity implements IEmployeeNotificationSetting {
	[EntityRepositoryType]?: MikroOrmEmployeeNotificationSettingRepository;

	/**
	 * Indicates whether payment-related notifications are enabled for the employee.
	 *
	 * When set to true, the employee will receive notifications regarding payment events.
	 * Defaults to true if not explicitly modified.
	 */
	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: true })
	payment?: boolean;

	/**
	 * Indicates whether assignment-related notifications are enabled for the employee.
	 *
	 * When enabled, the employee will receive notifications related to new or updated assignments.
	 * Defaults to true if no specific value is provided.
	 */
	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: true })
	assignment?: boolean;

	/**
	 * Indicates whether invitation-related notifications are enabled for the employee.
	 *
	 * If true, the employee will be notified of any invitations sent to them.
	 * The default value is true to ensure invitations are not missed.
	 */
	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: true })
	invitation?: boolean;

	/**
	 * Indicates whether mention-related notifications are enabled for the employee.
	 *
	 * This property controls whether the employee receives notifications when they are mentioned
	 * in comments, posts, or other communications. Defaults to true.
	 */
	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: true })
	mention?: boolean;

	/**
	 * Indicates whether comment-related notifications are enabled for the employee.
	 *
	 * When set to true, the employee will receive notifications when new comments are made
	 * in areas relevant to them. Defaults to true if not explicitly specified.
	 */
	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: true })
	comment?: boolean;

	/**
	 * Indicates whether message-related notifications are enabled for the employee.
	 *
	 * If true, the employee will receive notifications for direct messages or similar
	 * communications. The default value is true to ensure timely alerts.
	 */
	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: true })
	message?: boolean;

	/**
	 * Stores additional, custom notification preferences in a JSON format.
	 *
	 * This field allows for flexible storage of any extra preferences not covered by the
	 * standard boolean properties above. The underlying database column type adapts based on the
	 * database in use:
	 * - PostgreSQL: Uses 'jsonb'
	 * - MySQL: Uses 'json'
	 * - Other databases: Defaults to 'text'
	 *
	 * This field is required and must not be empty.
	 */
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
	 * The associated employee entity.
	 *
	 * This one-to-one relation (owning side) links to an Employee.
	 * Cascade insert/update is enabled and deletion cascades to this relation.
	 */
	@MultiORMOneToOne(() => Employee, {
		/** If set to true then it means that related object can be allowed to be inserted or updated in the database. */
		cascade: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE',

		/** This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.  */
		owner: true
	})
	@JoinColumn()
	employee?: IEmployee;

	/**
	 * The UUID of the associated employee.
	 *
	 * This column stores the relation ID for the linked Employee entity.
	 * It is automatically derived from the employee relation.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: EmployeeNotificationSetting) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId?: ID;
}
