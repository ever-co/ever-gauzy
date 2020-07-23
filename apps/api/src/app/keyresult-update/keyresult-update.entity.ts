import { Entity, Column, ManyToOne, RelationId, JoinColumn } from 'typeorm';
import {
	KeyResultUpdates as IKeyResultUpdate,
	KeyResultUpdateStatusEnum
} from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { KeyResult } from '../keyresult/keyresult.entity';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('key_result_update')
export class KeyResultUpdate extends TenantBase implements IKeyResultUpdate {
	@ApiProperty({ type: Number })
	@Column()
	update: number;

	@ApiProperty({ type: Number })
	@Column()
	progress: number;

	@ApiProperty({ type: String })
	@Column()
	owner: string;

	@ApiProperty({ type: String, enum: KeyResultUpdateStatusEnum })
	@IsEnum(KeyResultUpdateStatusEnum)
	@Column()
	status: string;

	@ApiProperty({ type: KeyResult })
	@ManyToOne((type) => KeyResult, (keyResult) => keyResult.update, {
		onDelete: 'CASCADE'
	})
	@JoinColumn({ name: 'keyResultId' })
	keyResult: KeyResult;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((keyResult: KeyResultUpdate) => keyResult.keyResult)
	@Column({ nullable: true })
	keyResultId?: string;
}
