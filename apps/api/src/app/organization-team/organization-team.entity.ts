import {
	Column,
	Entity,
	Index,
	OneToMany,
	ManyToMany,
	JoinTable,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Base } from '../core/entities/base';
import { OrganizationTeam as IOrganizationTeam } from '@gauzy/models';
import { OrganizationTeamEmployee } from '../organization-team-employee/organization-team-employee.entity';
import { Tag } from '../tags/tag.entity';

@Entity('organization_team')
export class OrganizationTeam extends Base implements IOrganizationTeam {
	@ApiProperty()
	@ManyToMany((type) => Tag)
	@JoinTable({
		name: 'tag_organizationTeams',
	})
	tags?: Tag[];

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

	@OneToMany(
		(type) => OrganizationTeamEmployee,
		(organizationTeamEmployee) => organizationTeamEmployee.organizationTeam,
		{
			cascade: true,
		}
	)
	members?: OrganizationTeamEmployee[];
}
