import { Column, ManyToOne, RelationId, JoinColumn } from 'typeorm';
import { IKeyResult, IKeyResultUpdate, KeyResultUpdateStatusEnum } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import {
	KeyResult,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmKeyResultUpdateRepository } from './repository/mikro-orm-keyresult-update.repository';

@MultiORMEntity('key_result_update', { mikroOrmRepository: () => MikroOrmKeyResultUpdateRepository })
export class KeyResultUpdate extends TenantOrganizationBaseEntity
	implements IKeyResultUpdate {
	@ApiProperty({ type: () => Number })
	@Column()
	update: number;

	@ApiProperty({ type: () => Number })
	@Column()
	progress: number;

	@ApiProperty({ type: () => String })
	@Column()
	owner: string;

	@ApiProperty({ type: () => String, enum: KeyResultUpdateStatusEnum })
	@IsEnum(KeyResultUpdateStatusEnum)
	@Column()
	status: string;

	@ApiProperty({ type: () => KeyResult })
	@ManyToOne(() => KeyResult, (keyResult) => keyResult.update, {
		onDelete: 'CASCADE'
	})
	@JoinColumn({ name: 'keyResultId' })
	keyResult?: IKeyResult;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: KeyResultUpdate) => it.keyResult)
	@Column({ nullable: true })
	keyResultId?: string;
}
