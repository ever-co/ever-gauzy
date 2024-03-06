import { RelationId, JoinColumn } from 'typeorm';
import { IKeyResult, IKeyResultUpdate, KeyResultUpdateStatusEnum } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import {
	KeyResult,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmKeyResultUpdateRepository } from './repository/mikro-orm-keyresult-update.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('key_result_update', { mikroOrmRepository: () => MikroOrmKeyResultUpdateRepository })
export class KeyResultUpdate extends TenantOrganizationBaseEntity
	implements IKeyResultUpdate {
	@ApiProperty({ type: () => Number })
	@MultiORMColumn()
	update: number;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn()
	progress: number;

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	owner: string;

	@ApiProperty({ type: () => String, enum: KeyResultUpdateStatusEnum })
	@IsEnum(KeyResultUpdateStatusEnum)
	@MultiORMColumn()
	status: string;

	@ApiProperty({ type: () => KeyResult })
	@MultiORMManyToOne(() => KeyResult, (keyResult) => keyResult.updates, {
		onDelete: 'CASCADE'
	})
	@JoinColumn({ name: 'keyResultId' })
	keyResult?: IKeyResult;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: KeyResultUpdate) => it.keyResult)
	@MultiORMColumn({ nullable: true, relationId: true })
	keyResultId?: string;
}
