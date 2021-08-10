import {
	Column,
	Entity,
	Index,
	OneToMany,
	ManyToMany,
	JoinTable
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import {
	IOrganizationTeam,
	IOrganizationTeamEmployee,
	IRequestApprovalTeam,
	ITag
} from '@gauzy/contracts';
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

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToMany 
    |--------------------------------------------------------------------------
    */
	@ApiPropertyOptional({ type: () => OrganizationTeamEmployee })
	@OneToMany(() => OrganizationTeamEmployee, (entity) => entity.organizationTeam, { 
		cascade: true 
	})
	members?: IOrganizationTeamEmployee[];

	@ApiPropertyOptional({ type: () => RequestApprovalTeam })
	@OneToMany(() => RequestApprovalTeam, (entity) => entity.team)
	requestApprovals?: IRequestApprovalTeam[];

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */
	@ApiProperty({ type: () => Tag })
	@ManyToMany(() => Tag, (tag) => tag.organizationTeam)
	@JoinTable({
		name: 'tag_organization_team'
	})
	tags?: ITag[];
}
