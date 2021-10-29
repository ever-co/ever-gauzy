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
	IGoal,
	IOrganizationTeam,
	IOrganizationTeamEmployee,
	IRequestApprovalTeam,
	ITag,
	ITask
} from '@gauzy/contracts';
import {
	Goal,
	OrganizationTeamEmployee,
	RequestApprovalTeam,
	Tag,
	Task,
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
   	
	/**
	 * OrganizationTeamEmployee
	 */
	@ApiPropertyOptional({ type: () => OrganizationTeamEmployee, isArray: true })
	@OneToMany(() => OrganizationTeamEmployee, (entity) => entity.organizationTeam, { 
		cascade: true 
	})
	members?: IOrganizationTeamEmployee[];

	/**
	 * RequestApprovalTeam
	 */
	@ApiPropertyOptional({ type: () => RequestApprovalTeam, isArray: true })
	@OneToMany(() => RequestApprovalTeam, (entity) => entity.team)
	requestApprovals?: IRequestApprovalTeam[];

	/**
	 * Goal
	 */
	@ApiProperty({ type: () => Goal, isArray: true })
	@OneToMany(() => Goal, (it) => it.ownerTeam, {
		onDelete: 'SET NULL'
	})
	goals?: IGoal[];

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */
	@ApiProperty({ type: () => Tag, isArray: true })
	@ManyToMany(() => Tag, (tag) => tag.organizationTeams, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'tag_organization_team'
	})
	tags?: ITag[];

	/**
	 * Task
	 */
	@ManyToMany(() => Task, (task) => task.teams, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable()
	tasks?: ITask[];
}
