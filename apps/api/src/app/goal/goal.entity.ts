import { Goal as IGoal, GoalLevelEnum } from '@gauzy/models';
import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { KeyResult } from '../keyresult/keyresult.entity';
import { Organization } from '../organization/organization.entity';
import { Employee } from '../employee/employee.entity';
import { Base } from '../core/entities/base';

@Entity('goal')
export class Goal extends Base implements IGoal {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	description?: string;

	@ApiProperty({ type: Employee })
	@ManyToOne((type) => Employee)
	@JoinColumn()
	owner: Employee;

	@ApiProperty({ type: Employee })
	@ManyToOne((type) => Employee)
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
