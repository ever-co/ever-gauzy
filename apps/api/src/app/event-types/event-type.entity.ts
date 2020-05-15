import {
	Column,
	Entity,
	Index,
	ManyToOne,
	RelationId,
	JoinColumn
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsNumber,
	IsOptional,
	IsBoolean
} from 'class-validator';
import { Base } from '../core/entities/base';
import { IEventType } from '@gauzy/models';
import { Organization } from '../organization/organization.entity';
import { Employee } from '../employee/employee.entity';

@Entity('eventType')
export class EventType extends Base implements IEventType {
	@ApiProperty({ type: Employee })
	@ManyToOne((type) => Employee, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	employee?: Employee;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((eventType: EventType) => eventType.employee)
	@Column({ nullable: true })
	readonly employeeId?: string;

	@ApiProperty({ type: Organization })
	@ManyToOne((type) => Organization, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	organization: Organization;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((eventType: EventType) => eventType.organization)
	readonly organizationId: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsNotEmpty()
	@Index()
	@Column({ type: 'numeric' })
	duration: number;

	@ApiProperty({ type: String })
	@IsString()
	@Index()
	@Column({ nullable: true })
	durationUnit: string;

	@ApiProperty({ type: String })
	@Index()
	@Column({ nullable: true })
	title: string;

	@ApiPropertyOptional({ type: String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	isActive: boolean;
}
