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
export class OrganizationTeamEmployee
	extends TenantOrganizationBaseEntity
	implements IOrganizationTeamEmployee
{
	/**
	 * enabled / disabled time tracking feature for team member
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ type: Boolean, nullable: true, default: true })
	isTrackingEnabled?: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * member's active task
	 */
	@ApiProperty({ type: () => Task })
	@ManyToOne(() => Task, (task) => task.organizationTeamEmployees, {
		onDelete: 'CASCADE',
	})
	public activeTask?: ITask;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationTeamEmployee) => it.activeTask)
	@Index()
	@Column({ type: String, nullable: true })
	activeTaskId?: string;

	/**
	 * OrganizationTeam
	 */
	@ApiProperty({ type: () => OrganizationTeam })
	@ManyToOne(
		() => OrganizationTeam,
		(organizationTeam) => organizationTeam.members,
		{
			onDelete: 'CASCADE',
		}
	)
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
	@ApiProperty({ type: () => Role })
	@ManyToOne(() => Role, {
		nullable: true,
		onDelete: 'CASCADE',
	})
	public role?: IRole;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: OrganizationTeamEmployee) => it.role)
	@Index()
	@Column({ nullable: true })
	public roleId?: IRole['id'];
}
