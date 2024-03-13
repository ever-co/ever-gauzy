import {
	RelationId,
	Unique,
	JoinColumn
} from 'typeorm';
import { ITimeSlot, ITimeSlotMinute } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsDateString, IsString } from 'class-validator';
import { TenantOrganizationBaseEntity } from './../../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../../core/decorators/entity';
import { ColumnIndex } from './../../core/decorators/entity/index.decorator';
import { TimeSlot } from './time-slot.entity';
import { MikroOrmTimeSlotMinuteRepository } from './repository/mikro-orm-time-slot-minute.repository';
import { MultiORMManyToOne } from '../../core/decorators/entity/relations';

@MultiORMEntity('time_slot_minute', { mikroOrmRepository: () => MikroOrmTimeSlotMinuteRepository })
@Unique(['timeSlotId', 'datetime'])
export class TimeSlotMinute extends TenantOrganizationBaseEntity implements ITimeSlotMinute {

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ default: 0 })
	keyboard?: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ default: 0 })
	mouse?: number;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@MultiORMColumn()
	datetime?: Date;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	@ApiProperty({ type: () => TimeSlot })
	@MultiORMManyToOne(() => TimeSlot, (it) => it.timeSlotMinutes, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	timeSlot?: ITimeSlot;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: TimeSlotMinute) => it.timeSlot)
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	readonly timeSlotId?: string;
}
