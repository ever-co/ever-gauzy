import { Entity, Column } from 'typeorm';
import { KeyResult as IKeyResult } from '@gauzy/models';
import { Base } from '../core/entities/base';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

@Entity('key_result')
export class KeyResult extends Base implements IKeyResult {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@Column()
	goalId: string;

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
}
