import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsOptional, IsString, IsNumber, IsBoolean, IsUUID, IsArray, IsNotEmpty } from 'class-validator';
import { isMySQL, isPostgres } from '@gauzy/config';
import {
	ID,
	IDashboardWidget,
	JsonData,
	IDashboard,
	IOrganizationTeam,
	IEmployee,
	IOrganizationProject,
	DashboardWidgetWidth
} from '@gauzy/contracts';
import {
	Dashboard,
	OrganizationTeam,
	Employee,
	OrganizationProject,
	TenantOrganizationBaseEntity
} from './../../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../../core/decorators/entity';
import { MikroOrmDashboardWidgetRepository } from './repository/mikro-orm-dashboard-widget.repository';

@MultiORMEntity('dashboard_widget', { mikroOrmRepository: () => MikroOrmDashboardWidgetRepository })
export class DashboardWidget extends TenantOrganizationBaseEntity implements IDashboardWidget {
	[EntityRepositoryType]?: MikroOrmDashboardWidgetRepository;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	name: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true })
	order?: number;

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	size?: DashboardWidgetWidth[];

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	color?: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	isVisible?: boolean;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	options?: JsonData;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Dashboard widget dashboard
	 */
	@ApiPropertyOptional({ type: () => Dashboard })
	@IsOptional()
	@MultiORMManyToOne(() => Dashboard, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	dashboard?: IDashboard;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: DashboardWidget) => it.dashboard)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	dashboardId?: ID;

	/**
	 * Dashboard widget employee
	 */
	@ApiPropertyOptional({ type: () => Employee })
	@IsOptional()
	@MultiORMManyToOne(() => Employee, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee?: IEmployee;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: DashboardWidget) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: ID;

	/**
	 * Dashboard widget project
	 */
	@ApiPropertyOptional({ type: () => OrganizationProject })
	@IsOptional()
	@MultiORMManyToOne(() => OrganizationProject, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	project?: IOrganizationProject;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: DashboardWidget) => it.project)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	projectId?: ID;

	/**
	 * Dashboard widget team
	 */
	@ApiPropertyOptional({ type: () => OrganizationTeam })
	@IsOptional()
	@MultiORMManyToOne(() => OrganizationTeam, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	organizationTeam?: IOrganizationTeam;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: DashboardWidget) => it.organizationTeam)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationTeamId?: ID;
}
