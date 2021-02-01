import { IOrganizationTeamEmployee } from '@gauzy/contracts';
import { Entity, Column, ManyToOne, JoinColumn, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import {
	Employee,
	OrganizationTeam,
	Role,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('organization_team_employee')
export class OrganizationTeamEmployee
	extends TenantOrganizationBaseEntity
	implements IOrganizationTeamEmployee {
	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Column()
	public organizationTeamId!: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Column()
	public employeeId!: string;

	@ManyToOne(
		() => OrganizationTeam,
		(organizationTeam) => organizationTeam.members,
		{
			onDelete: 'CASCADE'
		}
	)
	public organizationTeam!: OrganizationTeam;

	@ManyToOne(() => Employee, (employee) => employee.teams, {
		onDelete: 'CASCADE'
	})
	public employee!: Employee;

	@ApiProperty({ type: () => String })
	@IsString()
	@ManyToOne(() => Role, { nullable: true })
	@JoinColumn()
	role?: Role;

	@RelationId(
		(organizationTeamEmployee: OrganizationTeamEmployee) =>
			organizationTeamEmployee.role
	)
	readonly roleId?: string;
}
