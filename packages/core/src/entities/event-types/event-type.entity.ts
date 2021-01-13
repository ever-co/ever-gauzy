import {
	Column,
	Entity,
	Index,
	ManyToOne,
	RelationId,
	JoinColumn,
	ManyToMany,
	JoinTable
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsNumber,
	IsOptional,
	IsBoolean
} from 'class-validator';
import { IEventType } from '@gauzy/common';
import { Employee } from '../employee/employee.entity';
import { Tag } from '../tags/tag.entity';
import { TenantOrganizationBase } from '../tenant-organization-base';

@Entity('event_type')
export class EventType extends TenantOrganizationBase implements IEventType {
	@ApiProperty({ type: Tag })
	@ManyToMany((type) => Tag, (tag) => tag.eventType)
	@JoinTable({ name: 'tag_event_type' })
	tags?: Tag[];

	@ApiProperty({ type: Employee })
	@ManyToOne((type) => Employee, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	employee?: Employee;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((eventType: EventType) => eventType.employee)
	@Column({ nullable: true })
	readonly employeeId?: string;

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
