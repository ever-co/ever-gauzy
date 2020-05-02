import { OrganizationTeamEmployee as IOrganizationTeamEmployee } from '@gauzy/models';
import { Base } from '../core/entities/base';
import { Entity, Column, ManyToOne, JoinColumn, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { OrganizationTeam } from '../organization-team/organization-team.entity';
import { Employee } from '../employee/employee.entity';
import { Role } from '../role/role.entity';

@Entity('organization_team_employee')
export class OrganizationTeamEmployee extends Base
	implements IOrganizationTeamEmployee {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	public organizationTeamId!: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	public employeeId!: string;

	@ManyToOne(
		(type) => OrganizationTeam,
		(organizationTeam) => organizationTeam.members,
		{
			onDelete: 'CASCADE'
		}
	)
	public organizationTeam!: OrganizationTeam;

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
