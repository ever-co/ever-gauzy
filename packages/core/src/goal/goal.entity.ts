import { IGoal, GoalLevelEnum, IKeyResult } from '@gauzy/contracts';
import { Entity, Column, OneToMany, ManyToOne, JoinColumn, Index, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import {
	Employee,
	KeyResult,
	OrganizationTeam,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('goal')
export class Goal extends TenantOrganizationBaseEntity implements IGoal {
	
	@ApiProperty({ type: () => String })
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@Column()
	@IsOptional()
	description?: string;

	@ApiProperty({ type: () => String })
	@Column()
	deadline: string;

	@ApiProperty({ type: () => String, enum: GoalLevelEnum })
	@IsEnum(GoalLevelEnum)
	@Column()
	level: string;

	@ApiProperty({ type: () => Number })
	@Column()
	progress: number;

	@ManyToOne(() => OrganizationTeam)
	@JoinColumn()
	ownerTeam?: OrganizationTeam;

	@ApiProperty({ type: () => String })
	@RelationId((it: Goal) => it.ownerTeam)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	ownerTeamId?: string;

	@ManyToOne(() => Employee)
	@JoinColumn()
	ownerEmployee?: Employee;

	@ApiProperty({ type: () => String })
	@RelationId((it: Goal) => it.ownerEmployee)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	ownerEmployeeId?: string;

	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => Employee, {
		nullable: true
	})
	@JoinColumn()
	lead?: Employee;

	@ApiProperty({ type: () => String })
	@RelationId((it: Goal) => it.lead)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	leadId?: string;

	@ApiProperty({ type: () => KeyResult })
	@OneToMany(() => KeyResult, (keyResult) => keyResult.goal)
	@IsOptional()
	keyResults?: IKeyResult[];

	@ManyToOne(() => KeyResult, (keyResult) => keyResult.id)
	alignedKeyResult?: IKeyResult;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	alignedKeyResultId: string;
}
