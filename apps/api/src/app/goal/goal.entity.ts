import { Entity, Column, OneToMany } from 'typeorm';
import { Goal as IGoal } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { KeyResult } from '../keyresult/keyresult.entity';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('goal')
export class Goal extends TenantBase implements IGoal {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	description?: string;

	@ApiProperty({ type: String })
	@Column()
	owner: string;

	@ApiProperty({ type: String })
	@Column()
	lead: string;

	@ApiProperty({ type: String })
	@Column()
	deadline: string;

	@ApiProperty({ type: String })
	@Column()
	level: string;

	@ApiProperty({ type: Number })
	@Column()
	progress: number;

	@ApiProperty({ type: String })
	@Column()
	organizationId: string;

	@ApiProperty({ type: KeyResult })
	@OneToMany((type) => KeyResult, (keyResult) => keyResult.goal)
	@IsOptional()
	keyResults?: KeyResult[];
}
