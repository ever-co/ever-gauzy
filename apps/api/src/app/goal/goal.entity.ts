import { Entity, Column, OneToMany } from 'typeorm';
import { Goals as IGoal } from '@gauzy/models';
import { Base } from '../core/entities/base';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { KeyResult } from '../keyresult/keyresult.entity';

@Entity('goal')
export class Goal extends Base implements IGoal {
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
	type: string;

	@ApiProperty({ type: Number })
	@Column()
	progress: number;

	@ApiProperty({ type: String })
	@Column()
	organizationId: string;

	@ApiProperty({ type: KeyResult })
	@OneToMany((type) => KeyResult, (keyresult) => keyresult.goal)
	@IsOptional()
	keyResults?: KeyResult[];
}
