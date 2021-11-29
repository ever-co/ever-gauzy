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
import { IEmployee, IEventType, ITag } from '@gauzy/contracts';
import {
	Employee,
	Tag,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('event_type')
export class EventType
	extends TenantOrganizationBaseEntity
	implements IEventType {

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@IsNotEmpty()
	@Index()
	@Column({ type: 'numeric' })
	duration: number;

	@ApiProperty({ type: () => String })
	@IsString()
	@Index()
	@Column({ nullable: true })
	durationUnit: string;

	@ApiProperty({ type: () => String })
	@Index()
	@Column({ nullable: true })
	title: string;

	@ApiPropertyOptional({ type: () => String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	isActive: boolean;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */
	
	/**
	 * Employee
	 */
	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => Employee, { onDelete: 'CASCADE' })
	@JoinColumn()
	employee?: IEmployee;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: EventType) => it.employee)
	@IsOptional()
	@IsString()
	@Index()
	@Column({ nullable: true })
	readonly employeeId?: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */
	
	/**
	 * Tag
	 */
	@ApiProperty({ type: () => Tag, isArray: true })
	@ManyToMany(() => Tag, (tag) => tag.eventTypes, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'tag_event_type'
	})
	tags?: ITag[];
}
