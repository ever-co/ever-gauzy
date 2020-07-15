import { Goal as IGoal, GoalLevelEnum } from '@gauzy/models';
import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { KeyResult } from '../keyresult/keyresult.entity';
import { Organization } from '../organization/organization.entity';
import { Employee } from '../employee/employee.entity';
import { TenantBase } from '../core/entities/tenant-base';
import { OrganizationTeam } from '../organization-team/organization-team.entity';

@Entity('goal')
export class Goal extends TenantBase implements IGoal {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	description?: string;

	@ApiProperty({ type: Organization })
	@ManyToOne((type) => Organization)
	@JoinColumn()
	ownerOrg?: Organization;

	@ManyToOne((type) => OrganizationTeam)
	@JoinColumn()
	ownerTeam?: OrganizationTeam;

	@ManyToOne((type) => Employee)
	@JoinColumn()
	ownerEmployee?: Employee;

	@ApiProperty({ type: Employee })
	@ManyToOne((type) => Employee, { nullable: true })
	@JoinColumn()
	@IsOptional()
	lead?: Employee;

	@ApiProperty({ type: String })
	@Column()
	deadline: string;

	@ApiProperty({ type: String, enum: GoalLevelEnum })
	@IsEnum(GoalLevelEnum)
	@Column()
	level: string;

	@ApiProperty({ type: Number })
	@Column()
	progress: number;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	organizationId: string;

	@ManyToOne((type) => Organization, (organization) => organization.id)
	organization?: Organization;

	@ApiProperty({ type: KeyResult })
	@OneToMany((type) => KeyResult, (keyResult) => keyResult.goal)
	@IsOptional()
	keyResults?: KeyResult[];
}
