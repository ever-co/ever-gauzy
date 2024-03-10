import {
	Index,
	RelationId,
	JoinColumn,
	JoinTable
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsNumber,
	IsOptional,
} from 'class-validator';
import { IEmployee, IEventType, ITag } from '@gauzy/contracts';
import {
	Employee,
	Tag,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmEventTypeRepository } from './repository/mikro-orm-event-type.repository';
import { MultiORMManyToMany, MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('event_type', { mikroOrmRepository: () => MikroOrmEventTypeRepository })
export class EventType extends TenantOrganizationBaseEntity implements IEventType {

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@IsNotEmpty()
	@Index()
	@MultiORMColumn({
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	duration: number;

	@ApiProperty({ type: () => String })
	@IsString()
	@Index()
	@MultiORMColumn({ nullable: true })
	durationUnit: string;

	@ApiProperty({ type: () => String })
	@Index()
	@MultiORMColumn({ nullable: true })
	title: string;

	@ApiPropertyOptional({ type: () => String })
	@Index()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	description?: string;


	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Employee
	 */
	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, { onDelete: 'CASCADE' })
	@JoinColumn()
	employee?: IEmployee;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: EventType) => it.employee)
	@IsOptional()
	@IsString()
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
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
	@MultiORMManyToMany(() => Tag, (tag) => tag.eventTypes, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_event_type',
		joinColumn: 'tagEventId',
		inverseJoinColumn: 'tagId',
	})
	@JoinTable({
		name: 'tag_event_type'
	})
	tags?: ITag[];
}
