import { RelationId, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsDate } from 'class-validator';
import { AvailabilitySlotType, IAvailabilitySlot, IEmployee } from '@gauzy/contracts';
import { Employee, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmAvailabilitySlotRepository } from './repository/mikro-orm-availability-slot.repository';

@MultiORMEntity('availability_slot', { mikroOrmRepository: () => MikroOrmAvailabilitySlotRepository })
export class AvailabilitySlot extends TenantOrganizationBaseEntity implements IAvailabilitySlot {
	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn()
	startTime: Date;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn()
	endTime: Date;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@MultiORMColumn()
	allDay: boolean;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn({ type: 'text', nullable: true })
	type: AvailabilitySlotType;

	/**
	 * Employee
	 */
	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee?: IEmployee;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: AvailabilitySlot) => it.employee)
	@IsString()
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	readonly employeeId?: string;
}
