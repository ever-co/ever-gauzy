import { Entity, Column, ManyToOne, RelationId, JoinColumn } from 'typeorm';
import { IKeyResultUpdate, KeyResultUpdateStatusEnum } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { KeyResult, TenantOrganizationBaseEntity } from '../internal';

@Entity('key_result_update')
export class KeyResultUpdate
	extends TenantOrganizationBaseEntity
	implements IKeyResultUpdate {
	constructor(input?: DeepPartial<KeyResultUpdate>) {
		super(input);
	}

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
	@ManyToOne(() => KeyResult, (keyResult) => keyResult.update, {
		onDelete: 'CASCADE'
	})
	@JoinColumn({ name: 'keyResultId' })
	keyResult: KeyResult;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((keyResult: KeyResultUpdate) => keyResult.keyResult)
	@Column({ nullable: true })
	keyResultId?: string;
}
