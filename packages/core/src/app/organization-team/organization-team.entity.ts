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
import { IOrganizationTeam } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import {
	OrganizationTeamEmployee,
	RequestApprovalTeam,
	Tag,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('organization_team')
export class OrganizationTeam
	extends TenantOrganizationBaseEntity
	implements IOrganizationTeam {
	constructor(input?: DeepPartial<OrganizationTeam>) {
		super(input);
	}

	@ApiProperty()
	@ManyToMany(() => Tag, (tag) => tag.organizationTeam)
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
		() => OrganizationTeamEmployee,
		(organizationTeamEmployee) => organizationTeamEmployee.organizationTeam,
		{
			cascade: true
		}
	)
	members?: OrganizationTeamEmployee[];

	@OneToMany(
		() => RequestApprovalTeam,
		(requestApprovals) => requestApprovals.team
	)
	requestApprovals?: RequestApprovalTeam[];
}
