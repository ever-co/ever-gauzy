import { Entity, Column, ManyToOne, RelationId, JoinColumn } from 'typeorm';
import { KeyResultUpdates as IKeyResultUpdate } from '@gauzy/models';
import { Base } from '../core/entities/base';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { KeyResult } from '../keyresult/keyresult.entity';

@Entity('key_result_update')
export class KeyResultUpdate extends Base implements IKeyResultUpdate {
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
	status?: string;

	@ApiProperty({ type: KeyResult })
	@ManyToOne((type) => KeyResult, (keyresult) => keyresult.update)
	@JoinColumn({ name: 'keyresult_id' })
	keyResult: KeyResult;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((keyresult: KeyResultUpdate) => keyresult.keyResult)
	@Column({ nullable: true })
	readonly keyresult_id?: string;
}
