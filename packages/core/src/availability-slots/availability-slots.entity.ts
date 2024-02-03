import { Column, RelationId, JoinColumn, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsOptional,
	IsBoolean,
	IsDate
} from 'class-validator';
import {
	AvailabilitySlotType,
	IAvailabilitySlot,
	IEmployee
} from '@gauzy/contracts';
import {
	Employee,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmAvailabilitySlotRepository } from './repository/mikro-orm-availability-slot.repository';
import { MultiORMManyToOne } from './../core/decorators/entity/relations';

@MultiORMEntity('availability_slot', { mikroOrmRepository: () => MikroOrmAvailabilitySlotRepository })
export class AvailabilitySlot extends TenantOrganizationBaseEntity implements IAvailabilitySlot {

	@ApiProperty({ type: () => Date })
	@IsDate()
	@Column()
	startTime: Date;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@Column()
	endTime: Date;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column()
	allDay: boolean;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Column({ type: 'text', nullable: true })
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
	@Index()
	@Column({ nullable: true })
	readonly employeeId?: string;
}
