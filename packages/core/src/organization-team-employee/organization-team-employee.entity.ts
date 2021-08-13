import { IEmployee, IOrganizationTeam, IOrganizationTeamEmployee } from '@gauzy/contracts';
import { Entity, Column, ManyToOne, RelationId, Index } from 'typeorm';
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
	
	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */
   
   	/**
	 * OrganizationTeam 
	 */
	@ApiProperty({ type: () => OrganizationTeam })
	@ManyToOne(() => OrganizationTeam, (organizationTeam) => organizationTeam.members, { 
		onDelete: 'CASCADE' 
	})
	public organizationTeam!: IOrganizationTeam;

	@ApiProperty({ type: () => String })
	@RelationId((it: OrganizationTeamEmployee) => it.organizationTeam)
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	public organizationTeamId!: string;

    /**
	 * Employee 
	 */
	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => Employee, (employee) => employee.teams, {
		onDelete: 'CASCADE'
	})
	public employee!: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: OrganizationTeamEmployee) => it.employee)
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	public employeeId!: string;

	/**
	 * Role 
	 */
	@ApiProperty({ type: () => Role })
	@ManyToOne(() => Role, { 
		nullable: true,
		onDelete: 'CASCADE'
	})
	public role?: Role;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: OrganizationTeamEmployee) => it.role)
	@IsString()
	@Index()
	@Column({ nullable: true })
	readonly roleId?: string;
}
