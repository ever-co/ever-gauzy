import { Column, Entity, ManyToOne, RelationId, JoinColumn } from 'typeorm';
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
} from '@gauzy/common';
import { Employee } from '../employee/employee.entity';
import { TenantOrganizationBase } from '../tenant-organization-base';

@Entity('availability_slot')
export class AvailabilitySlot
	extends TenantOrganizationBase
	implements IAvailabilitySlot {
	@ApiProperty({ type: Employee })
	@ManyToOne(() => Employee, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	employee?: IEmployee;

	@ApiProperty({ type: String, readOnly: true })
	@IsOptional()
	@RelationId(
		(availabilitySlot: AvailabilitySlot) => availabilitySlot.employee
	)
	@Column({ nullable: true })
	readonly employeeId?: string;

	@ApiProperty({ type: Date })
	@IsDate()
	@Column()
	startTime: Date;

	@ApiProperty({ type: Date })
	@IsDate()
	@Column()
	endTime: Date;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column()
	allDay: boolean;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ type: 'text', nullable: true })
	type: AvailabilitySlotType;
}
