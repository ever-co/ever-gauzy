import { ID, IEmployee, IOrganizationTeam, IOrganizationTeamEmployee, IRole, ITask } from '@gauzy/contracts';
import { RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { Employee, OrganizationTeam, Role, Task, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmOrganizationTeamEmployeeRepository } from './repository/mikro-orm-organization-team-employee.repository';

@MultiORMEntity('organization_team_employee', { mikroOrmRepository: () => MikroOrmOrganizationTeamEmployeeRepository })
export class OrganizationTeamEmployee extends TenantOrganizationBaseEntity implements IOrganizationTeamEmployee {
	/**
	 * Enabled / Disabled Time Tracking Feature
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: Boolean, nullable: true, default: true })
	public isTrackingEnabled?: boolean;

	/**
	 * Organization Team Employee Order
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true })
	public order: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * member's active task
	 */
	@ApiProperty({ type: () => Task })
	@MultiORMManyToOne(() => Task, (it) => it.organizationTeamEmployees, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	public activeTask?: ITask;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationTeamEmployee) => it.activeTask)
	@ColumnIndex()
	@MultiORMColumn({ type: String, nullable: true, relationId: true })
	public activeTaskId?: ID;

	/**
	 * OrganizationTeam
	 */
	@ApiProperty({ type: () => OrganizationTeam })
	@MultiORMManyToOne(() => OrganizationTeam, (it) => it.members, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	public organizationTeam!: IOrganizationTeam;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: OrganizationTeamEmployee) => it.organizationTeam)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	public organizationTeamId: ID;

	/**
	 * Employee
	 */
	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, (it) => it.teams, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	public employee: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: OrganizationTeamEmployee) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	public employeeId: ID;

	/**
	 * Role
	 */
	@ApiPropertyOptional({ type: () => Role })
	@MultiORMManyToOne(() => Role, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	public role?: IRole;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationTeamEmployee) => it.role)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	public roleId?: ID;
}
