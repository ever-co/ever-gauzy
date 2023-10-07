import {
	IEmployee,
	IOrganizationTeam,
	IOrganizationTeamEmployee,
	IRole,
	ITask,
} from '@gauzy/contracts';
import { Entity, Column, ManyToOne, RelationId, Index } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import {
	Employee,
	OrganizationTeam,
	Role,
	Task,
	TenantOrganizationBaseEntity,
} from '../core/entities/internal';

@Entity('organization_team_employee')
export class OrganizationTeamEmployee extends TenantOrganizationBaseEntity implements IOrganizationTeamEmployee {
	/**
	 * enabled / disabled time tracking feature for team member
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ type: Boolean, nullable: true, default: true })
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
	@ManyToOne(() => Task, (it) => it.organizationTeamEmployees, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE',
	})
	public activeTask?: ITask;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationTeamEmployee) => it.activeTask)
	@Index()
	@Column({ type: String, nullable: true })
	public activeTaskId?: ITask['id'];

	/**
	 * OrganizationTeam
	 */
	@ApiProperty({ type: () => OrganizationTeam })
	@ManyToOne(() => OrganizationTeam, (it) => it.members, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	public organizationTeam!: IOrganizationTeam;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: OrganizationTeamEmployee) => it.organizationTeam)
	@Index()
	@Column()
	public organizationTeamId: IOrganizationTeam['id'];

	/**
	 * Employee
	 */
	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => Employee, (employee) => employee.teams, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE',
	})
	public employee: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: OrganizationTeamEmployee) => it.employee)
	@Index()
	@Column()
	public employeeId: IEmployee['id'];

	/**
	 * Role
	 */
	@ApiPropertyOptional({ type: () => Role })
	@ManyToOne(() => Role, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE',
	})
	public role?: IRole;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationTeamEmployee) => it.role)
	@Index()
	@Column({ nullable: true })
	public roleId?: IRole['id'];
}
