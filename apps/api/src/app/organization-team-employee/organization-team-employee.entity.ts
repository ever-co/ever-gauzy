import { OrganizationTeamEmployee as IOrganizationTeamEmployee } from '@gauzy/models';
import { Base } from '../core/entities/base';
import { Entity, Column, ManyToOne, JoinColumn, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { OrganizationTeams } from '../organization-teams/organization-teams.entity';
import { Employee } from '../employee/employee.entity';
import { Role } from '../role/role.entity';

@Entity('organization_team_employee')
export class OrganizationTeamEmployee extends Base
	implements IOrganizationTeamEmployee {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	public organizationTeamsId!: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	public employeeId!: string;

	@ManyToOne(
		(type) => OrganizationTeams,
		(organizationTeams) => organizationTeams.members,
		{
			onDelete: 'CASCADE'
		}
	)
	public organizationTeams!: OrganizationTeams;

	@ManyToOne(
		(type) => Employee,
		(employee) => employee.teams,
		{
			cascade: true
		}
	)
	public employee!: Employee;

	@ApiProperty({ type: String })
	@IsString()
	@ManyToOne((type) => Role, { nullable: true })
	@JoinColumn()
	role?: Role;

	@RelationId(
		(organizationTeamEmployee: OrganizationTeamEmployee) =>
			organizationTeamEmployee.role
	)
	readonly roleId?: string;
}
