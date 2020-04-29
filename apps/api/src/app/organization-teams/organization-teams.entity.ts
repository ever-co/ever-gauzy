import { Column, Entity, Index, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Base } from '../core/entities/base';
import { OrganizationTeams as IOrganizationTeams } from '@gauzy/models';
import { Employee } from '../employee/employee.entity';
import { OrganizationTeamEmployee } from '../organization-team-employee/organization-team-employee.entity';

@Entity('organization_team')
export class OrganizationTeams extends Base implements IOrganizationTeams {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	organizationId: string;

	// @ManyToMany((type) => Employee, { cascade: ['update'] })
	// @JoinTable({
	// 	name: 'organization_team_employee'
	// })
	members?: Employee[];

	@OneToMany(
		(type) => OrganizationTeamEmployee,
		(organizationTeamEmployee) =>
			organizationTeamEmployee.organizationTeams,
		{
			cascade: true
		}
	)
	teamEmployee?: OrganizationTeamEmployee[];
}
