import {
	Entity,
	Column,
	ManyToOne,
	RelationId,
	JoinColumn,
	OneToMany
} from 'typeorm';
import { KeyResult as IKeyResult } from '@gauzy/models';
import { Base } from '../core/entities/base';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { Goal } from '../goal/goal.entity';
import { KeyResultUpdate } from '../keyresult-update/keyresult-update.entity';

@Entity('key_result')
export class KeyResult extends Base implements IKeyResult {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	description?: string;

	@ApiProperty({ type: String })
	@Column()
	type: string;

	@ApiProperty({ type: Number })
	@Column({ nullable: true })
	@IsOptional()
	targetValue?: number;

	@ApiProperty({ type: Number })
	@Column({ nullable: true })
	@IsOptional()
	initialValue: number;

	@ApiProperty({ type: Number })
	@Column()
	update: number;

	@ApiProperty({ type: Number })
	@Column()
	progress: number;

	@ApiProperty({ type: String })
	@Column()
	owner: string;

	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	lead: string;

	@ApiProperty({ type: String })
	@Column()
	deadline: string;

	@ApiProperty({ type: Date })
	@Column({ nullable: true })
	@IsOptional()
	hardDeadline?: Date;

	@ApiProperty({ type: Date })
	@Column({ nullable: true })
	@IsOptional()
	softDeadline?: Date;

	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	status?: string;

	@ApiProperty({ type: Goal })
	@ManyToOne((type) => Goal, (goal) => goal.keyResults)
	@JoinColumn({ name: 'goalId' })
	goal: Goal;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((keyResult: KeyResult) => keyResult.goal)
	@Column({ nullable: true })
	readonly goalId?: string;

	@ApiProperty({ type: KeyResultUpdate })
	@OneToMany(
		(type) => KeyResultUpdate,
		(keyResultUpdate) => keyResultUpdate.keyResult
	)
	@IsOptional()
	updates?: KeyResultUpdate[];
}
