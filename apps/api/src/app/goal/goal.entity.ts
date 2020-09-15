import { IGoal, GoalLevelEnum } from '@gauzy/models';
import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { KeyResult } from '../keyresult/keyresult.entity';
import { Employee } from '../employee/employee.entity';
import { OrganizationTeam } from '../organization-team/organization-team.entity';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity('goal')
export class Goal extends TenantOrganizationBase implements IGoal {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	description?: string;

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

	@ApiProperty({ type: KeyResult })
	@OneToMany((type) => KeyResult, (keyResult) => keyResult.goal)
	@IsOptional()
	keyResults?: KeyResult[];

	@ManyToOne((type) => KeyResult, (keyResult) => keyResult.id)
	alignedKeyResult?: KeyResult;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	alignedKeyResultId: string;
}
