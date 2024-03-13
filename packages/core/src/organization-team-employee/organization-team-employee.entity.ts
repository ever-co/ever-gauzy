import { IEmployee, IOrganizationTeam, IOrganizationTeamEmployee, IRole, ITask } from '@gauzy/contracts';
import { RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { Employee, OrganizationTeam, Role, Task, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { ColumnIndex } from './../core/decorators/entity/index.decorator';
import { MikroOrmOrganizationTeamEmployeeRepository } from './repository/mikro-orm-organization-team-employee.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('organization_team_employee', { mikroOrmRepository: () => MikroOrmOrganizationTeamEmployeeRepository })
export class OrganizationTeamEmployee extends TenantOrganizationBaseEntity implements IOrganizationTeamEmployee {
	/**
	 * enabled / disabled time tracking feature for team member
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: Boolean, nullable: true, default: true })
	public isTrackingEnabled?: boolean;

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
	public activeTaskId?: ITask['id'];

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
	public organizationTeamId: IOrganizationTeam['id'];

	/**
	 * Employee
	 */
	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, (employee) => employee.teams, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	public employee: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: OrganizationTeamEmployee) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	public employeeId: IEmployee['id'];

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
	public roleId?: IRole['id'];

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	public order: number;
}
