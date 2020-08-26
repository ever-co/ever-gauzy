import { Column, Entity, ManyToOne, RelationId, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsOptional,
	IsBoolean,
	IsDate
} from 'class-validator';
import { IAvailabilitySlots } from '@gauzy/models';
import { Organization } from '../organization/organization.entity';
import { Employee } from '../employee/employee.entity';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('availability_slots')
export class AvailabilitySlots extends TenantBase
	implements IAvailabilitySlots {
	@ApiProperty({ type: Employee })
	@ManyToOne((type) => Employee, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	employee?: Employee;

	@ApiProperty({ type: String, readOnly: true })
	@IsOptional()
	@RelationId(
		(availabilitySlots: AvailabilitySlots) => availabilitySlots.employee
	)
	@Column({ nullable: true })
	readonly employeeId?: string;

	@ApiProperty({ type: Organization })
	@ManyToOne((type) => Organization, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	organization: Organization;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(availabilitySlots: AvailabilitySlots) => availabilitySlots.organization
	)
	readonly organizationId: string;

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
	@Column()
	type: string;
}
