import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RelationId, JoinColumn } from 'typeorm';
import { IsNotEmpty, IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { ID, IEmployee, ITimeSlot, ITimeSlotSession } from '@gauzy/contracts';
import { Employee, TenantOrganizationBaseEntity, TimeSlot } from './../../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne
} from './../../core/decorators/entity';
import { MikroOrmTimeSlotSessionRepository } from './repository/mikro-orm-time-slot-session.repository';

@MultiORMEntity('time_slot_session', { mikroOrmRepository: () => MikroOrmTimeSlotSessionRepository })
export class TimeSlotSession extends TenantOrganizationBaseEntity implements ITimeSlotSession {
	/**
	 * Session identifier for tracking across multiple TimeSlots
	 */
	@ApiProperty({
		type: () => String,
		description: 'Session identifier for tracking across multiple TimeSlots'
	})
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn()
	sessionId: string;

	/**
	 * Session start time
	 */
	@ApiPropertyOptional({
		type: () => 'timestamptz',
		description: 'Session start time'
	})
	@IsOptional()
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	startTime?: Date;

	/**
	 * Session last activity time
	 */
	@ApiPropertyOptional({
		type: () => 'timestamptz',
		description: 'Session last activity time'
	})
	@IsOptional()
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	lastActivity?: Date;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * TimeSlot relationship
	 */
	@MultiORMManyToOne(() => TimeSlot, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	timeSlot: ITimeSlot;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: TimeSlotSession) => it.timeSlot)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	timeSlotId: ID;

	/**
	 * Employee relationship
	 */
	@MultiORMManyToOne(() => Employee, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee: IEmployee;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: TimeSlotSession) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId: ID;
}
