import { RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { ID, IEmployee, IOrganizationTeam, IOrganizationTeamEmployee, IRole, ITask } from '@gauzy/contracts';
import { Employee, OrganizationTeam, Role, Task, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmOrganizationTeamEmployeeRepository } from './repository/mikro-orm-organization-team-employee.repository';

@MultiORMEntity('organization_team_employee', { mikroOrmRepository: () => MikroOrmOrganizationTeamEmployeeRepository })
export class OrganizationTeamEmployee extends TenantOrganizationBaseEntity implements IOrganizationTeamEmployee {
	// Organization Team Employee Order
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true })
	order?: number;

	// Enabled / Disabled Time Tracking For The Team Member
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: Boolean, nullable: true, default: true })
	isTrackingEnabled?: boolean;

	// Manager of the organization team
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@ColumnIndex()
	@MultiORMColumn({ type: Boolean, nullable: true, default: false })
	isManager?: boolean;

	// Assigned At Manager of the organization team
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	assignedAt?: Date;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * member's active task
	 */
	@MultiORMManyToOne(() => Task, (it) => it.organizationTeamEmployees, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	activeTask?: ITask;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationTeamEmployee) => it.activeTask)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	activeTaskId?: ID;

	/**
	 * OrganizationTeam
	 */
	@MultiORMManyToOne(() => OrganizationTeam, (it) => it.members, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizationTeam!: IOrganizationTeam;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: OrganizationTeamEmployee) => it.organizationTeam)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	organizationTeamId: ID;

	/**
	 * Employee
	 */
	@MultiORMManyToOne(() => Employee, (it) => it.teams, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	employee!: IEmployee;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: OrganizationTeamEmployee) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId: ID;

	/**
	 * Role
	 */
	@MultiORMManyToOne(() => Role, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	role?: IRole;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationTeamEmployee) => it.role)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	roleId?: ID;
}
