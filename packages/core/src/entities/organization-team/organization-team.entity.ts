import {
	Column,
	Entity,
	Index,
	OneToMany,
	ManyToMany,
	JoinTable
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IOrganizationTeam } from '@gauzy/common';
import { OrganizationTeamEmployee } from '../organization-team-employee/organization-team-employee.entity';
import { Tag } from '../tags/tag.entity';
import { RequestApprovalTeam } from '../request-approval-team/request-approval-team.entity';
import { TenantOrganizationBase } from '../tenant-organization-base';

@Entity('organization_team')
export class OrganizationTeam
	extends TenantOrganizationBase
	implements IOrganizationTeam {
	@ApiProperty()
	@ManyToMany((type) => Tag, (tag) => tag.organizationTeam)
	@JoinTable({
		name: 'tag_organization_team'
	})
	tags?: Tag[];

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@OneToMany(
		(type) => OrganizationTeamEmployee,
		(organizationTeamEmployee) => organizationTeamEmployee.organizationTeam,
		{
			cascade: true
		}
	)
	members?: OrganizationTeamEmployee[];

	@OneToMany(
		(type) => RequestApprovalTeam,
		(requestApprovals) => requestApprovals.team
	)
	requestApprovals?: RequestApprovalTeam[];
}
