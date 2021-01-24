import { IGoal, GoalLevelEnum, IKeyResult } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import {
	Employee,
	KeyResult,
	OrganizationTeam,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('goal')
export class Goal extends TenantOrganizationBaseEntity implements IGoal {
	constructor(input?: DeepPartial<Goal>) {
		super(input);
	}

	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	description?: string;

	@ManyToOne(() => OrganizationTeam)
	@JoinColumn()
	ownerTeam?: OrganizationTeam;

	@ManyToOne(() => Employee)
	@JoinColumn()
	ownerEmployee?: Employee;

	@ApiProperty({ type: Employee })
	@ManyToOne(() => Employee, {
		nullable: true
	})
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
	@OneToMany(() => KeyResult, (keyResult) => keyResult.goal)
	@IsOptional()
	keyResults?: IKeyResult[];

	@ManyToOne(() => KeyResult, (keyResult) => keyResult.id)
	alignedKeyResult?: IKeyResult;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	alignedKeyResultId: string;
}
