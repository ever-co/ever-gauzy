import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsArray, IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { isMySQL, isPostgres } from '@gauzy/config';
import { ID, IDashboard, IEmployee, IUser, JsonData } from '@gauzy/contracts';
import { DashboardWidget, Employee, TenantOrganizationBaseEntity, User } from '../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany
} from '../core/decorators/entity';
import { IsEmployeeBelongsToOrganization } from '../shared/validators';
import { MikroOrmDashboardRepository } from './repository/mikro-orm-dashboard.repository';

@MultiORMEntity('dashboard', { mikroOrmRepository: () => MikroOrmDashboardRepository })
export class Dashboard extends TenantOrganizationBaseEntity implements IDashboard {
	[EntityRepositoryType]?: MikroOrmDashboardRepository;

	/**
	 * Name of the dashboard
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	name: string;

	/**
	 * Identifier of the dashboard
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	identifier: string;

	/**
	 * Description of the dashboard
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	/**
	 * Content of the dashboard
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsArray()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	contentHtml?: JsonData;

	/**
	 * Indicates if the dashboard is the default dashboard
	 */
	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	isDefault?: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * The employee for whom the dashboard is created
	 */
	@ApiPropertyOptional({ type: () => Employee })
	@IsOptional()
	@IsObject()
	@IsEmployeeBelongsToOrganization()
	@MultiORMManyToOne(() => Employee, {
		nullable: true, // Indicates if relation column value can be nullable or not.
		onDelete: 'CASCADE' // Database cascade action on delete.
	})
	@JoinColumn()
	employee?: IEmployee;

	/**
	 * The employee ID for whom the dashboard is created
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@IsEmployeeBelongsToOrganization()
	@RelationId((dashboard: Dashboard) => dashboard.employee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: ID;

	/**
	 * The user who created the dashboard
	 */
	@MultiORMManyToOne(() => User, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	createdByUser?: IUser;

	/**
	 * The user ID who created the dashboard
	 */
	@RelationId((dashboard: Dashboard) => dashboard.createdByUser)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	createdByUserId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Dashboard Widgets
	 */
	@MultiORMOneToMany(() => DashboardWidget, (it) => it.dashboard)
	widgets?: DashboardWidget[];
}
